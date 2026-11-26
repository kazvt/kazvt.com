// Shared same-origin preset for the doorway and full-screen Dice.
// Neutral charcoal body with raised grey folds and the existing gloss.
const VIP_LIQUID_PARAMETERS = [
  ["theatre", "on"],
  ["fullscreen", "on"],
  ["color_low", "#030303"],
  ["color_mid", "#171717"],
  ["color_high", "#626262"],
  ["viscosity", "0"],
  ["speed", "2"],
  ["fold_size", "0.65"],
  ["zoom", "0.74"],
  ["wrap_edges", "off"],
  ["height_range", "0.45"],
  ["relief", "1.65"],
  ["detail", "61%"],
  ["gloss", "1.80"],
  ["sharpness", "33"],
  ["blur", "0"],
  ["saturation", "0.88"],
  ["contrast", "0.90"],
  ["brightness", "-0.060"],
  ["render_quality", "50%"],
];

export const VIP_LIQUID_SOURCE = `/liquid/?${new URLSearchParams(VIP_LIQUID_PARAMETERS)}`;
