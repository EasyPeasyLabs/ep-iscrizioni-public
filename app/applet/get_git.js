const { execSync } = require('child_process');
try {
  const output = execSync('git log -p src/components/ui/MechaLemon.tsx').toString();
  require('fs').writeFileSync('git_log_mechalemon.txt', output);
  console.log('Git log saved.');
} catch (e) {
  console.error(e);
}
