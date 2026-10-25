import {
  AdditiveBlending,
  DoubleSide,
  MeshPhysicalMaterial,
  type Texture,
} from 'three';
import { reference } from '../../domain/reference';

/**
 * Display-specific materials (Ticket 05).
 *
 * The panel is an emissive physical surface, not a MeshBasicMaterial sticker:
 * it is lit only by its own artwork, dims toward grazing angles and carries the
 * soft optical crease. A second, transparent physical plate supplies the cover
 * glass reflection and Fresnel sheen. No existing material family is changed.
 */

export interface DisplaySurface {
  readonly material: MeshPhysicalMaterial;
  /** Update the crease and off-axis uniforms without rebuilding the shader. */
  setFoldAngle(degrees: number): void;
}

interface DisplaySurfaceOptions {
  readonly texture: Texture;
  readonly crease: boolean;
  readonly name: string;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function createDisplaySurface(options: DisplaySurfaceOptions): DisplaySurface {
  const uniforms = {
    uOffAxisDimFloor: { value: reference.display.offAxisDimFloor },
    uOffAxisDimExponent: { value: reference.display.offAxisDimExponent },
    uCreaseWidth: { value: reference.display.creaseWidth / reference.innerDisplay.activeWidth },
    uCreaseStrength: { value: 0 },
    uCreaseEnabled: { value: options.crease ? 1 : 0 },
  };

  const material = new MeshPhysicalMaterial({
    color: 0x05070c,
    metalness: reference.display.metalness,
    roughness: 0.42,
    clearcoat: 0.16,
    clearcoatRoughness: 0.2,
    specularIntensity: 0.2,
    emissive: 0xffffff,
    emissiveMap: options.texture,
    emissiveIntensity: reference.display.emissiveIntensity,
    map: null,
    envMapIntensity: 0.04,
    side: DoubleSide,
  });
  material.name = options.name;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uOffAxisDimFloor = uniforms.uOffAxisDimFloor;
    shader.uniforms.uOffAxisDimExponent = uniforms.uOffAxisDimExponent;
    shader.uniforms.uCreaseWidth = uniforms.uCreaseWidth;
    shader.uniforms.uCreaseStrength = uniforms.uCreaseStrength;
    shader.uniforms.uCreaseEnabled = uniforms.uCreaseEnabled;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uOffAxisDimFloor;
        uniform float uOffAxisDimExponent;
        uniform float uCreaseWidth;
        uniform float uCreaseStrength;
        uniform float uCreaseEnabled;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        // Emission lobe: a real OLED loses apparent brightness off axis. The
        // floor keeps the 70-degree view legible without flattening the glass.
        float displayFacing = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
        float displayDim = mix(uOffAxisDimFloor, 1.0, pow(displayFacing, uOffAxisDimExponent));

        // One restrained optical seam over the 10 mm bridge: a gaussian dip
        // plus a faint warm flank. No hard fold line, and disabled on the cover.
        float displayAcross = abs(vEmissiveMapUv.x - 0.5);
        float displaySeam = exp(-pow(displayAcross / uCreaseWidth, 2.0));
        float displayFlank = exp(-pow((displayAcross - uCreaseWidth * 1.9) / (uCreaseWidth * 1.15), 2.0));
        float displayCrease = 1.0 - uCreaseStrength * displaySeam * uCreaseEnabled;
        vec3 displayLift = vec3(1.0, 0.87, 0.7) * displayFlank * uCreaseStrength * 0.05 * uCreaseEnabled;

        totalEmissiveRadiance *= displayDim * displayCrease;
        totalEmissiveRadiance += displayLift;`,
      );
  };

  const surface: DisplaySurface = {
    material,
    setFoldAngle(degrees: number): void {
      const openness = clamp01(degrees / reference.hinge.maxFoldAngleDegrees);
      uniforms.uCreaseStrength.value =
        reference.display.creaseStrengthFlat +
        (reference.display.creaseStrengthFolded - reference.display.creaseStrengthFlat) *
          (1 - openness);
    },
  };
  surface.setFoldAngle(reference.hinge.presentationAngleDegrees);
  return surface;
}

/** The separate cover-glass plate over an emissive display. */
export function createDisplayGlass(name: string): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: 0x05070d,
    metalness: 0,
    roughness: reference.display.glassRoughness,
    clearcoat: 1,
    clearcoatRoughness: reference.display.glassClearcoatRoughness,
    ior: reference.frame.frontGlass.ior,
    specularIntensity: 1,
    transparent: true,
    opacity: reference.display.glassOpacity,
    blending: AdditiveBlending,
    depthWrite: false,
    envMapIntensity: reference.display.glassEnvMapIntensity,
    side: DoubleSide,
  });
  material.name = name;
  return material;
}
