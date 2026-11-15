import photosynthesisImg from '../assets/images/diagram_photosynthesis_leaf_1794734883982.jpg';
import solarSystemImg from '../assets/images/diagram_solar_system_1794734883330.jpg';
import pythagorasImg from '../assets/images/diagram_pythagoras_proof_1794734885357.jpg';
import bohrAtomImg from '../assets/images/diagram_bohr_atom_1794734885229.jpg';
import waterCycleImg from '../assets/images/diagram_water_cycle_1794734885678.jpg';
import { ImageMediaKey } from '../types/muse';

export const IMAGE_ASSET_BY_KEY: Record<ImageMediaKey, string> = {
  photosynthesis: photosynthesisImg,
  solar: solarSystemImg,
  pythagoras: pythagorasImg,
  atom: bohrAtomImg,
  water_cycle: waterCycleImg,
};

export const VIDEO_THUMBNAIL_BY_ID: Record<string, string> = {
  vid_photosynthesis: photosynthesisImg,
  vid_pythagoras: pythagorasImg,
  vid_solar: solarSystemImg,
  vid_bohr_atom: bohrAtomImg,
  vid_water_cycle: waterCycleImg,
  vid_tutorial_pythagoras_solve: pythagorasImg,
  vid_exam_science_revision: photosynthesisImg,
};
