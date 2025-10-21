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
      },
    },
    async (flags: any, key?: string, value?: string) => {
      // Handle --show flag
      if (flags.show) {
        const config = loadConfig();
        console.log('Current configuration:');
        console.log(JSON.stringify(config, null, 2));
        console.log(`\nConfig file: ${getConfigPath()}`);
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

  const provider = (await clack.select({
    message: 'Embedding Provider',
    options: [
      {
        value: 'local',
        label: 'Local',
        hint: 'Offline, free, good quality (all-MiniLM-L6-v2)',
      },
      {
        value: 'openai',
        label: 'OpenAI',
        hint: 'Best quality, requires API key ($0.02/1M tokens)',
      },
      {
        value: 'none',
        label: 'None',
        hint: 'Disable embeddings (lexical scoring only)',
      },
    ],
    initialValue: currentConfig.embedProvider || 'local',
  })) as ForestConfig['embedProvider'];

  if (clack.isCancel(provider)) {
    clack.cancel('Configuration cancelled');
    return;
  }

  const newConfig: ForestConfig = {
    embedProvider: provider,
  };

  // OpenAI-specific settings
  if (provider === 'openai') {
    const apiKey = (await clack.password({
      message: 'OpenAI API Key',
      validate: (value) => {
        if (!value || value.length === 0) return 'API key is required';
        if (!value.startsWith('sk-')) return 'API key should start with sk-';
      },
    })) as string;

    if (clack.isCancel(apiKey)) {
      clack.cancel('Configuration cancelled');
      return;
    }

    const model = (await clack.select({
      message: 'OpenAI Model',
      options: [
        {
          value: 'text-embedding-3-small',
          label: 'text-embedding-3-small',
          hint: '1536-dim, $0.02/1M tokens (recommended)',
        },
        {
          value: 'text-embedding-3-large',
          label: 'text-embedding-3-large',
          hint: '3072-dim, $0.13/1M tokens (maximum quality)',
        },
      ],
      initialValue: currentConfig.openaiModel || 'text-embedding-3-small',
    })) as ForestConfig['openaiModel'];

    if (clack.isCancel(model)) {
      clack.cancel('Configuration cancelled');
      return;
    }

    newConfig.openaiApiKey = apiKey;
    newConfig.openaiModel = model;
  }

  // Local model settings
  if (provider === 'local') {
    const useCustomModel = await clack.confirm({
      message: 'Use custom local model?',
      initialValue: !!currentConfig.localModel,
    });

    if (clack.isCancel(useCustomModel)) {
      clack.cancel('Configuration cancelled');
      return;
    }

    if (useCustomModel) {
      const localModel = (await clack.text({
        message: 'Local model name',
        placeholder: 'Xenova/all-MiniLM-L6-v2',
        initialValue: currentConfig.localModel,
        validate: (value) => {
          if (!value || value.length === 0) return 'Model name is required';
        },
      })) as string;

      if (clack.isCancel(localModel)) {
        clack.cancel('Configuration cancelled');
        return;
      }

      newConfig.localModel = localModel;
    }
  }

  // Tagging method configuration
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
    initialValue: currentConfig.taggingMethod || 'lexical',
  })) as ForestConfig['taggingMethod'];

  if (clack.isCancel(taggingMethod)) {
    clack.cancel('Configuration cancelled');
    return;
  }

  newConfig.taggingMethod = taggingMethod;

  // LLM tagging model selection
  if (taggingMethod === 'llm') {
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
      initialValue: currentConfig.llmTaggerModel || 'gpt-5-nano',
    })) as ForestConfig['llmTaggerModel'];

    if (clack.isCancel(llmModel)) {
      clack.cancel('Configuration cancelled');
      return;
    }

    newConfig.llmTaggerModel = llmModel;
  }

  const colorScheme = (await clack.select({
    message: 'Color scheme',
    options: listColorSchemes().map(({ value, label, description }) => ({
      value,
      label,
      hint: description,
    })),
    initialValue: currentConfig.colorScheme || DEFAULT_COLOR_SCHEME,
  })) as ForestConfig['colorScheme'];

  if (clack.isCancel(colorScheme)) {
    clack.cancel('Configuration cancelled');
    return;
  }

  newConfig.colorScheme = colorScheme;

  // Save config
  saveConfig(newConfig);

  const s = clack.spinner();
  s.start('Saving configuration');
  await new Promise((resolve) => setTimeout(resolve, 500));
  s.stop('Configuration saved');

  clack.outro(`Config file: ${getConfigPath()}`);

  // Suggest next steps
  if (provider === 'openai') {
    console.log('\nNext steps:');
    console.log('  forest capture --stdin < note.md    # Test OpenAI embeddings');
    console.log('  forest admin:recompute-embeddings   # Upgrade existing notes');
  }
}
