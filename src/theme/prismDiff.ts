import {Prism} from 'prism-react-renderer';
if (!Prism.languages.diff) {
  Prism.languages.diff = {
    coord: /^@@.*@@$/m,
    deleted: /^-[\s\S]*$/m,
    inserted: /^\+[\s\S]*$/m,
    comment: /^diff.*$/m,
  };
}