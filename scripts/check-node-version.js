const pkg = require('../package.json');
const required = pkg.engines.node.match(/(\d+)\.(\d+)\.(\d+)/);
if (!required) process.exit(0);

const min = [Number(required[1]), Number(required[2]), Number(required[3])];
const cur = process.versions.node.split('.').map(Number);

for (let i = 0; i < 3; i++) {
  if (cur[i] > min[i]) break;
  if (cur[i] < min[i]) {
    const label = min.join('.');
    console.error(
      `\n\x1b[31mError: Node.js >= ${label} is required (found v${process.versions.node}).\x1b[0m`
    );
    console.error('\nHow to fix:');
    console.error('  • Using nvm: nvm install    (reads .nvmrc)');
    console.error('  • Manual: download from https://nodejs.org/en/download\n');
    process.exit(1);
  }
}
