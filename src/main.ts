import './styles/tokens.css';
import './styles/site.css';
import { boot } from './app/boot';

try {
  boot();
} catch {
  // The static page (copy, specification and disclaimer) is already in the
  // document; keep it visible rather than failing with a blank first paint.
  document.body.classList.add('is-static-fallback');
  const bootOverlay = document.querySelector<HTMLElement>('#boot');
  if (bootOverlay) bootOverlay.hidden = true;
}
