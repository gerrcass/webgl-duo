import {
  AmbientLight,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  RectAreaLight,
  Scene,
  ShadowMaterial,
  ShaderMaterial,
  SpotLight,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { reference } from '../domain/reference';
import { resolvePixelRatio, type QualityTier } from '../domain/quality';
import type { DuoState } from '../domain/store';
import { PlaceholderDevice } from './device/placeholder-device';
import type { DuoDeviceModel } from './device/device-model';
import { createStudioEnvironment, type StudioEnvironment } from './environment';
import { HERO_FOV_DEGREES, computeHeroFraming } from './framing';

/** A three-degree backward lean; art direction, not a product dimension. */
const PRODUCT_TILT_RADIANS = 0.052;

/**
 * The procedural studio set (§9): a curved gradient sweep, a key/rim/fill rig,
 * an ACES-tonemapped renderer and a PMREM environment. The product is whatever
 * `DuoDeviceModel` the studio is handed; today that is the real-scale
 * placeholder block, later it is the two-half hinge rig.
 *
 * Scene units are metres. The camera is a 85 mm-equivalent lens; nothing here
 * scales the device to fit. At narrow viewports the camera dollies back instead.
 */
export class StudioScene {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;

  private readonly renderer: WebGLRenderer;
  private readonly device: DuoDeviceModel;
  private readonly environment: StudioEnvironment;
  private readonly sweep: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly shadowCatcher: Mesh<PlaneGeometry, ShadowMaterial>;
  private readonly keyLight: SpotLight;
  private readonly rimLight: SpotLight;
  private readonly keyArea: RectAreaLight;
  private readonly fillArea: RectAreaLight;
  private readonly motionEnabled: boolean;

  private viewportWidth = 1;
  private viewportHeight = 1;
  private quality: QualityTier;

  constructor(
    renderer: WebGLRenderer,
    quality: QualityTier,
    options: { motionEnabled: boolean; device?: DuoDeviceModel },
  ) {
    RectAreaLightUniformsLib.init();

    this.renderer = renderer;
    this.quality = quality;
    this.motionEnabled = options.motionEnabled;
    this.device = options.device ?? new PlaceholderDevice();

    this.camera = new PerspectiveCamera(
      HERO_FOV_DEGREES,
      1,
      0.02,
      25,
    );
    this.camera.name = 'hero-camera';

    this.environment = createStudioEnvironment(renderer);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 1.05;

    this.sweep = this.createSweep();
    this.scene.add(this.sweep);

    this.shadowCatcher = this.createShadowCatcher();
    this.scene.add(this.shadowCatcher);

    const lights = this.createLights();
    this.keyLight = lights.key;
    this.rimLight = lights.rim;
    this.keyArea = lights.keyArea;
    this.fillArea = lights.fillArea;
    this.scene.add(
      this.keyLight,
      this.keyLight.target,
      this.rimLight,
      this.rimLight.target,
      this.keyArea,
      this.fillArea,
      lights.scrim,
      lights.ambient,
    );

    const tilt = PRODUCT_TILT_RADIANS;
    this.device.object.rotation.x = -tilt;
    this.scene.add(this.device.object);

    this.applyQuality(quality);
  }

  applyState(state: DuoState): void {
    this.device.setFoldAngle(state.foldAngle);
    this.device.setColourway(state.colourway);
    this.device.setExploded(state.exploded);
  }

  setViewport(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    this.camera.aspect = this.viewportWidth / this.viewportHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewportWidth, this.viewportHeight, false);
    this.renderer.setPixelRatio(
      resolvePixelRatio(this.quality.id, window.devicePixelRatio),
    );
  }

  applyQuality(tier: QualityTier): void {
    this.quality = tier;
    this.renderer.setPixelRatio(resolvePixelRatio(tier.id, window.devicePixelRatio));
    if (this.viewportWidth > 1 && this.viewportHeight > 1) {
      this.renderer.setSize(this.viewportWidth, this.viewportHeight, false);
    }

    for (const light of [this.keyLight, this.rimLight]) {
      light.shadow.mapSize.set(tier.shadowMapSize, tier.shadowMapSize);
      if (light.shadow.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  update(elapsedSeconds: number, introProgress: number): void {
    const framing = computeHeroFraming(
      { width: this.viewportWidth, height: this.viewportHeight },
      this.motionEnabled ? introProgress : 1,
    );

    const settled = !this.motionEnabled || introProgress >= 1;
    const idleAzimuth =
      settled && this.motionEnabled ? Math.sin(elapsedSeconds * 0.22) * 0.004 : 0;
    const idleElevation =
      settled && this.motionEnabled
        ? Math.sin(elapsedSeconds * 0.17 + 0.8) * 0.002
        : 0;

    const azimuth = framing.azimuthRadians + idleAzimuth;
    const elevation = framing.elevationRadians + idleElevation;
    const distance = framing.distance;

    this.camera.position.set(
      framing.target.x + distance * Math.cos(elevation) * Math.sin(azimuth),
      framing.target.y + distance * Math.sin(elevation),
      framing.target.z + distance * Math.cos(elevation) * Math.cos(azimuth),
    );
    this.camera.lookAt(
      framing.target.x,
      framing.target.y,
      framing.target.z,
    );
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.device.dispose();
    this.sweep.geometry.dispose();
    this.sweep.material.dispose();
    this.shadowCatcher.geometry.dispose();
    this.shadowCatcher.material.dispose();
    this.environment.dispose();
    this.scene.clear();
  }

  private createSweep(): Mesh<BufferGeometry, ShaderMaterial> {
    const profile = buildSweepProfile();
    const widthSegments = 48;
    const halfWidth = 3;
    const positions: number[] = [];
    const indices: number[] = [];

    for (const point of profile) {
      for (let i = 0; i <= widthSegments; i += 1) {
        const x = -halfWidth + (i / widthSegments) * halfWidth * 2;
        positions.push(x, point.y, point.z);
      }
    }

    const stride = widthSegments + 1;
    for (let row = 0; row < profile.length - 1; row += 1) {
      for (let column = 0; column < widthSegments; column += 1) {
        const a = row * stride + column;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new ShaderMaterial({
      uniforms: {
        uFloor: { value: new Color(reference.studio.floorColor) },
        uHorizon: { value: new Color(reference.studio.horizonColor) },
        uBackdrop: { value: new Color(reference.studio.backdropColor) },
        uPool: { value: new Color(reference.studio.poolColor) },
        uPoolCenter: { value: new Vector3(0, 0, -0.35) },
      },
      side: DoubleSide,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;

        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPosition = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uFloor;
        uniform vec3 uHorizon;
        uniform vec3 uBackdrop;
        uniform vec3 uPool;
        uniform vec3 uPoolCenter;
        varying vec3 vWorldPosition;

        void main() {
          float floorMix = smoothstep(-1.25, 1.6, vWorldPosition.z);
          vec3 color = mix(uHorizon, uFloor, floorMix);

          float wallMix = smoothstep(0.0, 1.25, vWorldPosition.y);
          color = mix(color, uBackdrop, wallMix);

          float poolDistance = length(vWorldPosition.xz - uPoolCenter.xz);
          float pool = exp(-poolDistance * poolDistance * 1.8);
          color += uPool * pool * 0.42;

          float backGlow = exp(-pow((vWorldPosition.y - 0.7) / 0.85, 2.0));
          backGlow *= 1.0 - smoothstep(-1.9, -0.3, vWorldPosition.z);
          color += uPool * backGlow * 0.5;

          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      toneMapped: true,
    });

    const mesh = new Mesh(geometry, material);
    mesh.name = 'studio-sweep';
    mesh.receiveShadow = false;
    return mesh;
  }

  private createShadowCatcher(): Mesh<PlaneGeometry, ShadowMaterial> {
    const geometry = new PlaneGeometry(6, 6);
    geometry.rotateX(-Math.PI / 2);
    const material = new ShadowMaterial({
      color: 0x000000,
      opacity: 0.72,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = 'contact-shadow';
    mesh.position.y = 0.0006;
    mesh.receiveShadow = true;
    return mesh;
  }

  private createLights(): {
    key: SpotLight;
    rim: SpotLight;
    keyArea: RectAreaLight;
    fillArea: RectAreaLight;
    scrim: RectAreaLight;
    ambient: AmbientLight;
  } {
    const target = new Vector3(0, reference.envelope.height / 2, 0);

    const keyDistance = reference.studio.key.distance;
    const keyElevation = 0.72;
    const keyAzimuth = -Math.PI / 4;
    const keyPosition = new Vector3(
      Math.sin(keyAzimuth) * Math.cos(keyElevation) * keyDistance,
      Math.sin(keyElevation) * keyDistance,
      Math.cos(keyAzimuth) * Math.cos(keyElevation) * keyDistance,
    );

    const key = new SpotLight(
      new Color(reference.studio.key.color),
      95,
      7,
      0.5,
      1,
      2,
    );
    key.name = 'key-light';
    key.position.copy(keyPosition);
    key.target.position.copy(target);
    key.castShadow = true;
    key.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 7;
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.0012;

    const rim = new SpotLight(
      new Color(reference.studio.rim.color),
      72,
      6,
      0.46,
      1,
      2,
    );
    rim.name = 'rim-light';
    rim.position.set(1.9, 1.5, -1.2);
    rim.target.position.copy(target);
    rim.castShadow = false;
    rim.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
    rim.shadow.camera.near = 0.4;
    rim.shadow.camera.far = 6;
    rim.shadow.bias = -0.00015;
    rim.shadow.normalBias = 0.0012;

    const keyArea = new RectAreaLight(
      new Color(reference.studio.key.color),
      7,
      reference.studio.key.width,
      reference.studio.key.height,
    );
    keyArea.name = 'key-softbox';
    keyArea.position.copy(keyPosition);
    keyArea.lookAt(target);

    const fillArea = new RectAreaLight(
      new Color(reference.studio.fill.color),
      1.9,
      reference.studio.fill.width,
      reference.studio.fill.height,
    );
    fillArea.name = 'fill-light';
    fillArea.position.set(-1.1, 0.5, 1.7);
    fillArea.lookAt(target);

    const scrim = new RectAreaLight(
      new Color(0xdbe5ff),
      3.4,
      1.6,
      1,
    );
    scrim.name = 'front-scrim';
    scrim.position.set(0.1, 1.2, 1.5);
    scrim.lookAt(target);

    const ambient = new AmbientLight(0x2b3242, 0.32);
    ambient.name = 'ambient-lift';

    return { key, rim, keyArea, fillArea, scrim, ambient };
  }
}

interface SweepPoint {
  readonly y: number;
  readonly z: number;
}

/**
 * A 4.0 m cyclorama: flat floor, a 1.0 m quarter-round cove, then the backdrop.
 * Dimensions derive from the sheet's floor sweep; the wall top is art direction.
 */
function buildSweepProfile(): SweepPoint[] {
  const sweep = reference.studio.floorSweep;
  const nearZ = sweep / 2;
  const bendRadius = sweep / 4;
  const floorEndZ = farZ() + bendRadius;
  const wallTop = 3.0;
  const points: SweepPoint[] = [];

  const floorSegments = 16;
  for (let i = 0; i <= floorSegments; i += 1) {
    const t = i / floorSegments;
    points.push({ z: nearZ + (floorEndZ - nearZ) * t, y: 0 });
  }

  const bendSegments = 20;
  for (let i = 1; i <= bendSegments; i += 1) {
    const angle = (i / bendSegments) * (Math.PI / 2);
    points.push({
      z: floorEndZ - bendRadius * Math.sin(angle),
      y: bendRadius * (1 - Math.cos(angle)),
    });
  }

  const wallSegments = 12;
  for (let i = 1; i <= wallSegments; i += 1) {
    const t = i / wallSegments;
    points.push({
      z: farZ(),
      y: bendRadius + (wallTop - bendRadius) * t,
    });
  }

  return points;
}

function farZ(): number {
  return -reference.studio.floorSweep / 2;
}
