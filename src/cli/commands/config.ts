import * as clack from '@clack/prompts';
import { loadConfig, saveConfig, getConfigPath, type ForestConfig } from '../../lib/config';
import { DEFAULT_COLOR_SCHEME, listColorSchemes } from '../../lib/color-schemes';

type ClercModule = typeof import('clerc');

export function createConfigCommand(clerc: ClercModule) {
  return clerc.defineCommand(
    {
      name: 'config',
      description: 'Configure Forest settings interactively',
      parameters: ['[key]', '[value]'],
      flags: {
        reset: {
          type: Boolean,
          description: 'Reset config to defaults',
        },
        show: {
          type: Boolean,
          description: 'Show current config',
        },
        json: {
          type: Boolean,
          description: 'Emit JSON output (use with --show)',
        },
      },
    },
    async ({ flags, parameters }: any) => {
      // Handle --show flag
      if (flags.show) {
        const config = loadConfig();
        if (flags.json) {
          // Pure JSON for programmatic consumption — redact secrets
          const safe = { ...config };
          if (safe.openaiApiKey) safe.openaiApiKey = `${safe.openaiApiKey.slice(0, 7)}...`;
          if (safe.openrouterApiKey) safe.openrouterApiKey = `${safe.openrouterApiKey.slice(0, 8)}...`;
          console.log(JSON.stringify({ config: safe, configPath: getConfigPath() }, null, 2));
        } else {
          const safe = { ...config };
          if (safe.openaiApiKey) safe.openaiApiKey = `${safe.openaiApiKey.slice(0, 7)}...`;
          if (safe.openrouterApiKey) safe.openrouterApiKey = `${safe.openrouterApiKey.slice(0, 8)}...`;
          console.log('Current configuration:');
          console.log(JSON.stringify(safe, null, 2));
          console.log(`\nConfig file: ${getConfigPath()}`);
        }
        return;
      }

      // Handle --reset flag
      if (flags.reset) {
        const confirm = await clack.confirm({
          message: 'Reset configuration to defaults?',
        });
        if (confirm) {
          saveConfig({});
          clack.outro('Configuration reset');
        } else {
          clack.cancel('Reset cancelled');
        }
        return;
      }

      // Handle direct set (forest config key value)
      const [key, value] = parameters?._ ?? [];
      if (key && value) {
        const config = loadConfig();
        (config as any)[key] = value;
        saveConfig(config);
        console.log(`Set ${key} = ${value}`);
        return;
      }

      // Interactive wizard
      await runConfigWizard();
    },
  );
}

async function runConfigWizard() {
  clack.intro('Forest Configuration');

  const currentConfig = loadConfig();
  const config: ForestConfig = { ...currentConfig };

  while (true) {
    const choice = (await clack.select({
      message: 'Select a setting to configure',
      options: [
        {
          value: 'dbPath',
          label: `Database Path (${config.dbPath || 'platform default'})`,
          hint: 'Global database location accessible from anywhere',
        },
        {
          value: 'embedProvider',
          label: `Embedding Provider (${config.embedProvider || 'openrouter'})`,
        },
        {
          value: 'openrouterApiKey',
          label: `OpenRouter API Key (${config.openrouterApiKey ? 'set' : 'not set'})`,
          hint: 'Required when Embedding Provider = OpenRouter',
        },
        {
          value: 'openaiApiKey',
          label: `OpenAI API Key (${config.openaiApiKey ? 'set' : 'not set'})`,
          hint: 'Required when Embedding Provider = OpenAI',
        },
        {
          value: 'taggingMethod',
          label: `Tagging Method (${config.taggingMethod || 'lexical'})`,
        },
        {
          value: 'llmTaggerModel',
          label: `LLM Tagger Model (${config.llmTaggerModel || 'gpt-5-nano'})`,
          hint: 'Only used when Tagging Method = LLM',
        },
        {
          value: 'writeModel',
          label: `Write Model (${config.writeModel || 'gpt-5'})`,
        },
        {
          value: 'synthesizeModel',
          label: `Synthesize Model (${config.synthesizeModel || 'gpt-5'})`,
        },
        {
          value: 'colorScheme',
          label: `Color Scheme (${config.colorScheme || DEFAULT_COLOR_SCHEME})`,
        },
        {
          value: 'markdown',
          label: `Markdown Output (${formatMarkdownSummary(config)})`,
        },
        { value: 'save', label: 'Save and exit' },
        { value: 'cancel', label: 'Cancel without saving' },
      ],
    })) as
      | 'dbPath'
      | 'embedProvider'
      | 'openrouterApiKey'
      | 'openaiApiKey'
      | 'taggingMethod'
      | 'llmTaggerModel'
      | 'writeModel'
      | 'synthesizeModel'
      | 'colorScheme'
      | 'markdown'
      | 'save'
      | 'cancel';

    if (clack.isCancel(choice) || choice === 'cancel') {
      clack.cancel('Configuration cancelled');
      return;
    }

    if (choice === 'save') {
      break;
    }

    switch (choice) {
      case 'dbPath': {
        let shouldPrompt = true;
        if (config.dbPath) {
          const nextAction = (await clack.select({
            message: `Current database path: ${config.dbPath}`,
            options: [
              { value: 'update', label: 'Change path' },
              { value: 'clear', label: 'Clear (use platform default)' },
              { value: 'back', label: 'Back' },
            ],
          })) as 'update' | 'clear' | 'back';

          if (clack.isCancel(nextAction) || nextAction === 'back') {
            shouldPrompt = false;
          } else if (nextAction === 'clear') {
            delete config.dbPath;
            shouldPrompt = false;
          }
        }

        if (shouldPrompt) {
          const dbPathInput = (await clack.text({
            message: 'Database file path',
            placeholder: '~/forest.db',
            initialValue: config.dbPath || '',
            validate: (value) => {
              if (!value || value.trim().length === 0) return 'Path is required';
              // Allow ~ prefix or absolute paths
              if (!value.startsWith('~') && !value.startsWith('/')) {
                return 'Path must be absolute (start with / or ~)';
              }
            },
          })) as string;

          if (!clack.isCancel(dbPathInput)) {
            config.dbPath = dbPathInput.trim();
          }
        }
        break;
      }

      case 'embedProvider': {
        const provider = (await clack.select({
          message: 'Embedding Provider',
          options: [
            {
              value: 'openrouter',
              label: 'OpenRouter (Recommended)',
              hint: 'Qwen3 8B, 4096-dim, 33K context, $0.01/M tokens',
            },
            {
              value: 'openai',
              label: 'OpenAI',
              hint: 'text-embedding-3-small, 1536-dim, $0.02/1M tokens',
            },
            {
              value: 'mock',
              label: 'Mock',
              hint: 'Deterministic hashing, for testing (no API calls)',
            },
            {
              value: 'none',
              label: 'None',
              hint: 'Disable embeddings (lexical scoring only)',
            },
          ],
          initialValue: config.embedProvider || 'openrouter',
        })) as ForestConfig['embedProvider'];

        if (!clack.isCancel(provider)) {
          config.embedProvider = provider;
        }
        break;
      }

      case 'openrouterApiKey': {
        let shouldPrompt = true;
        if (config.openrouterApiKey) {
          const nextAction = (await clack.select({
            message: 'OpenRouter API key',
            options: [
              { value: 'update', label: 'Update key' },
              { value: 'clear', label: 'Clear key' },
              { value: 'back', label: 'Back' },
            ],
          })) as 'update' | 'clear' | 'back';

          if (clack.isCancel(nextAction) || nextAction === 'back') {
            shouldPrompt = false;
          } else if (nextAction === 'clear') {
            delete config.openrouterApiKey;
            shouldPrompt = false;
          }
        }

        if (shouldPrompt) {
          const apiKey = (await clack.password({
            message: 'OpenRouter API Key',
            validate: (value) => {
              if (!value || value.length === 0) return 'API key is required';
              if (!value.startsWith('sk-or-')) return 'API key should start with sk-or-';
            },
          })) as string;

          if (!clack.isCancel(apiKey)) {
            config.openrouterApiKey = apiKey;
          }
        }
        break;
      }

      case 'openaiApiKey': {
        let shouldPrompt = true;
        if (config.openaiApiKey) {
          const nextAction = (await clack.select({
            message: 'OpenAI API key',
            options: [
              { value: 'update', label: 'Update key' },
              { value: 'clear', label: 'Clear key' },
              { value: 'back', label: 'Back' },
            ],
          })) as 'update' | 'clear' | 'back';

          if (clack.isCancel(nextAction) || nextAction === 'back') {
            shouldPrompt = false;
          } else if (nextAction === 'clear') {
            delete config.openaiApiKey;
            shouldPrompt = false;
          }
        }

        if (shouldPrompt) {
          const apiKey = (await clack.password({
            message: 'OpenAI API Key',
            validate: (value) => {
              if (!value || value.length === 0) return 'API key is required';
              if (!value.startsWith('sk-')) return 'API key should start with sk-';
            },
          })) as string;

          if (!clack.isCancel(apiKey)) {
            config.openaiApiKey = apiKey;
          }
        }
        break;
      }

      case 'taggingMethod': {
        const taggingMethod = (await clack.select({
          message: 'Tagging Method',
          options: [
            {
              value: 'lexical',
              label: 'Lexical (frequency-based)',
              hint: 'Free, fast, no API calls',
            },
            {
              value: 'llm',
              label: 'LLM (GPT-5-nano)',
              hint: 'Smart, contextual, ~$0.000005/note',
            },
            {
              value: 'none',
              label: 'None',
              hint: 'Disable auto-tagging',
            },
          ],
          initialValue: config.taggingMethod || 'lexical',
        })) as ForestConfig['taggingMethod'];

        if (!clack.isCancel(taggingMethod)) {
          config.taggingMethod = taggingMethod;
        }
        break;
      }

      case 'llmTaggerModel': {
        if (config.taggingMethod !== 'llm') {
          console.log('LLM tagging model is only used when Tagging Method = LLM.');
          break;
        }

        const llmModel = (await clack.select({
          message: 'LLM Tagging Model',
          options: [
            {
              value: 'gpt-5-nano',
              label: 'gpt-5-nano',
              hint: 'Recommended: 10x cheaper, great quality',
            },
            {
              value: 'gpt-4o-mini',
              label: 'gpt-4o-mini',
              hint: 'Fallback option',
            },
            {
              value: 'gpt-4o',
              label: 'gpt-4o',
              hint: 'Maximum quality, more expensive',
            },
          ],
          initialValue: config.llmTaggerModel || 'gpt-5-nano',
        })) as ForestConfig['llmTaggerModel'];

        if (!clack.isCancel(llmModel)) {
          config.llmTaggerModel = llmModel;
        }
        break;
      }

      case 'writeModel': {
        const writeModel = (await clack.select({
          message: 'Default model for `forest write`',
          options: [
            {
              value: 'gpt-5',
              label: 'gpt-5',
              hint: 'Most capable (default)',
            },
            {
              value: 'gpt-5-mini',
              label: 'gpt-5-mini',
              hint: 'Faster, cheaper, slightly less detailed',
            },
            {
              value: 'gpt-4o',
              label: 'gpt-4o',
              hint: 'Highly capable, good general-purpose option',
            },
          ],
          initialValue: config.writeModel || 'gpt-5',
        })) as ForestConfig['writeModel'];

        if (!clack.isCancel(writeModel)) {
          config.writeModel = writeModel;
        }
        break;
      }

      case 'synthesizeModel': {
        const synthesizeModel = (await clack.select({
          message: 'Default model for `forest node synthesize`',
          options: [
            {
              value: 'gpt-5',
              label: 'gpt-5',
              hint: 'Maximum quality (default)',
            },
            {
              value: 'gpt-5-mini',
              label: 'gpt-5-mini',
              hint: 'Faster and cheaper for quick drafts',
            },
          ],
          initialValue: config.synthesizeModel || 'gpt-5',
        })) as ForestConfig['synthesizeModel'];

        if (!clack.isCancel(synthesizeModel)) {
          config.synthesizeModel = synthesizeModel;
        }
        break;
      }

      case 'colorScheme': {
        const colorScheme = (await clack.select({
          message: 'Color scheme',
          options: listColorSchemes().map(({ value, label, description }) => ({
            value,
            label,
            hint: description,
          })),
          initialValue: config.colorScheme || DEFAULT_COLOR_SCHEME,
        })) as ForestConfig['colorScheme'];

        if (!clack.isCancel(colorScheme)) {
          config.colorScheme = colorScheme;
        }
        break;
      }

      case 'markdown': {
        const currentWidth = config.markdown?.width ?? 90;
        const widthInput = await clack.text({
          message: 'Markdown wrap width (characters, minimum 20)',
          initialValue: String(currentWidth),
          placeholder: '90',
          validate: (value) => {
            if (!value || value.trim().length === 0) return 'Enter a width (e.g., 90)';
            const parsed = Number(value.trim());
            if (!Number.isFinite(parsed) || parsed < 20) return 'Width must be a number ≥ 20';
          },
        });

        if (clack.isCancel(widthInput)) break;

        const nextWidth = Number(widthInput.trim());

        const reflowChoice = (await clack.select({
          message: 'Reflow Markdown paragraphs?',
          options: [
            { value: 'true', label: 'Enable reflow (wrap to configured width)' },
            { value: 'false', label: 'Disable reflow (preserve original line breaks)' },
          ],
          initialValue: (config.markdown?.reflowText ?? true) ? 'true' : 'false',
        })) as 'true' | 'false';

        if (clack.isCancel(reflowChoice)) break;

        config.markdown = {
          width: nextWidth,
          reflowText: reflowChoice === 'true',
        };
        break;
      }
    }
  }

  saveConfig(config);

  const s = clack.spinner();
  s.start('Saving configuration');
  await new Promise((resolve) => setTimeout(resolve, 500));
  s.stop('Configuration saved');

  clack.outro(`Config file: ${getConfigPath()}`);
}

function formatMarkdownSummary(config: ForestConfig): string {
  const width = config.markdown?.width ?? 90;
  const reflow = config.markdown?.reflowText ?? true;
  return `${width} cols, ${reflow ? 'reflow on' : 'reflow off'}`;
}
