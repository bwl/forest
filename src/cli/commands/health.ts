import { getHealthReport, isHealthy, HealthCheck } from '../../core/health';
import { handleError } from '../shared/utils';

type ClercModule = typeof import('clerc');

type HealthFlags = {
  json?: boolean;
};

export function createHealthCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'health',
      description: 'Check system health and configuration status',
      flags: {
        json: {
          type: Boolean,
          description: 'Emit JSON output',
        },
      },
    },
    async ({ flags }) => {
      try {
        await runHealth(flags as HealthFlags);
      } catch (error) {
        handleError(error);
      }
    },
  );
}

async function runHealth(flags: HealthFlags) {
  const report = await getHealthReport();

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('forest health');
  console.log('');

  printCheck('Database', report.database);
  if (report.database.path) {
    console.log(`  path: ${report.database.path}`);
  }
  if (typeof report.database.sizeBytes === 'number') {
    const sizeMB = (report.database.sizeBytes / (1024 * 1024)).toFixed(2);
    console.log(`  size: ${sizeMB} MB`);
  }
  console.log('');

  printCheck('Embedding Provider', report.embeddingProvider);
  if (report.embeddingProvider.provider) {
    console.log(`  provider: ${report.embeddingProvider.provider}`);
  }
  console.log('');

  if (report.openaiKey) {
    printCheck('OpenAI API Key', report.openaiKey);
    console.log('');
  }

  if (report.localTransformer) {
    printCheck('Local Transformer', report.localTransformer);
    console.log('');
  }

  if (isHealthy(report)) {
    console.log('✔ All systems operational');
  } else {
    console.log('⚠ Some checks failed. Review the output above.');
    process.exitCode = 1;
  }
}

function printCheck(label: string, check: HealthCheck) {
  const icon = check.status === 'ok' ? '✔' : check.status === 'warning' ? '⚠' : '✖';
  console.log(`${icon} ${label}: ${check.message}`);
}
