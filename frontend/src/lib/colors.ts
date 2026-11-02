// swatch colors for the variant colors in the catalog (prod_var.prod_attr). Unknown names get a neutral grey.
const SWATCHES: Record<string, string> = {
  beige: '#d9c4a3',
  ivory: '#f3ead6',
  white: '#ffffff',
  whitewash: '#efe9df',
  natural: '#d8b98c',
  'natural/beige': '#d8bf98',
  'light brown': '#b98a5e',
  'middle brown': '#8b5a34',
  'dark brown': '#5a3a24',
  mocha: '#7b5b47',
  'light gray': '#cfcfcf',
  gray: '#9b9b9b',
  'dark gray': '#555555',
  'greyish blue': '#7f8fa3',
  black: '#222222',
};

export const swatch = (color: string) => SWATCHES[color.trim().toLowerCase()] ?? '#bdbdbd';
