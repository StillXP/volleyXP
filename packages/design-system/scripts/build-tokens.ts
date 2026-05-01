import StyleDictionary from 'style-dictionary';
import config from '../style-dictionary.config.ts';

async function main() {
  console.log('Building design tokens...');
  try {
    const sd = new StyleDictionary(config);
    await sd.buildAllPlatforms();
    console.log('Tokens built successfully → src/styles/tokens/');
  } catch (err) {
    console.error('Token build failed:', err);
    process.exit(1);
  }
}

main();
