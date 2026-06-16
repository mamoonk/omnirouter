import type { ProviderConfig } from '@shared/types'

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    name: 'gemini',
    displayName: 'Gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', contextWindow: 1_000_000, strengths: ['factual', 'long_doc', 'creative', 'code'], capabilities: ['tool_use', 'vision'] },
      { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', contextWindow: 1_000_000, strengths: ['factual'], capabilities: ['tool_use'] },
      { id: 'imagen-3.0-generate-002', displayName: 'Imagen 3.0', contextWindow: 4000, strengths: ['creative'], capabilities: ['image'] }
    ],
    rpmLimit: 15,
    tpmLimit: 1_000_000,
    dailyTokenLimit: 1_500_000,
    dailyRequestLimit: 1_500,
    tier: 1,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'groq',
    displayName: 'Groq',
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'llama-3.3-70b-versatile', displayName: 'Llama 3.3 70B', contextWindow: 131_072, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] },
      { id: 'mixtral-8x7b-32768', displayName: 'Mixtral 8x7B', contextWindow: 32_768, strengths: ['factual', 'creative'] }
    ],
    rpmLimit: 30,
    tpmLimit: 6_000,
    dailyTokenLimit: 1_000_000,
    tier: 1,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'mistral',
    displayName: 'Mistral',
    apiKeyEnv: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    models: [
      { id: 'mistral-small-latest', displayName: 'Mistral Small', contextWindow: 32_000, strengths: ['factual', 'code'], capabilities: ['tool_use'] },
      { id: 'open-mistral-7b', displayName: 'Open Mistral 7B', contextWindow: 8_000, strengths: ['factual'] }
    ],
    rpmLimit: 5,
    tpmLimit: 500_000,
    dailyTokenLimit: 500_000,
    tier: 2,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'cohere',
    displayName: 'Cohere',
    apiKeyEnv: 'COHERE_API_KEY',
    baseUrl: 'https://api.cohere.com/v2',
    models: [
      { id: 'command-r', displayName: 'Command R', contextWindow: 128_000, strengths: ['factual', 'long_doc'], capabilities: ['tool_use'] },
      { id: 'command-r-plus', displayName: 'Command R+', contextWindow: 128_000, strengths: ['factual', 'long_doc', 'code'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 10,
    tpmLimit: 100_000,
    dailyTokenLimit: 500_000,
    tier: 2,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'openai',
    displayName: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128_000, strengths: ['code', 'creative', 'factual'], capabilities: ['tool_use', 'vision'] },
      { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128_000, strengths: ['code', 'creative', 'factual'], capabilities: ['tool_use', 'vision'] },
      { id: 'dall-e-3', displayName: 'DALL-E 3', contextWindow: 4000, strengths: ['creative'], capabilities: ['image'] }
    ],
    rpmLimit: 10,
    tpmLimit: 200_000,
    dailyTokenLimit: 200_000,
    tier: 3,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-3-haiku-20240307', displayName: 'Claude 3 Haiku', contextWindow: 200_000, strengths: ['code', 'factual'], capabilities: ['tool_use', 'vision'] },
      { id: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet', contextWindow: 200_000, strengths: ['code', 'creative', 'factual'], capabilities: ['tool_use', 'vision'] }
    ],
    rpmLimit: 5,
    tpmLimit: 100_000,
    dailyTokenLimit: 100_000,
    tier: 3,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', displayName: 'DeepSeek V3', contextWindow: 128_000, strengths: ['code', 'factual', 'creative'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 30,
    tpmLimit: 500_000,
    dailyTokenLimit: 500_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'together',
    displayName: 'Together AI',
    apiKeyEnv: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1',
    models: [
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', displayName: 'Llama 3.1 8B', contextWindow: 131_072, strengths: ['factual', 'code'], capabilities: ['tool_use'] },
      { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1', displayName: 'Mixtral 8x22B', contextWindow: 65_536, strengths: ['creative', 'factual', 'code'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 10,
    tpmLimit: 100_000,
    dailyTokenLimit: 200_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'fireworks',
    displayName: 'Fireworks AI',
    apiKeyEnv: 'FIREWORKS_API_KEY',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: [
      { id: 'accounts/fireworks/models/llama-v3p1-8b-instruct', displayName: 'Llama 3.1 8B', contextWindow: 131_072, strengths: ['factual', 'code'], capabilities: ['tool_use'] },
      { id: 'accounts/fireworks/models/mixtral-8x7b-instruct', displayName: 'Mixtral 8x7B', contextWindow: 32_768, strengths: ['creative', 'factual'] }
    ],
    rpmLimit: 10,
    tpmLimit: 100_000,
    dailyTokenLimit: 200_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'openrouter',
    displayName: 'OpenRouter',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', displayName: 'Llama 3.3 70B', contextWindow: 131_072, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] },
      { id: 'mistralai/mistral-small-3.1-24b-instruct', displayName: 'Mistral Small 3.1', contextWindow: 32_000, strengths: ['factual', 'code'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 10,
    tpmLimit: 100_000,
    dailyTokenLimit: 100_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'nvidia',
    displayName: 'NVIDIA NIM',
    apiKeyEnv: 'NVIDIA_API_KEY',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: [
      { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', displayName: 'Nemotron 3 Super', contextWindow: 262_144, strengths: ['code', 'factual', 'creative'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 10,
    tpmLimit: 200_000,
    dailyTokenLimit: 500_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'perplexity',
    displayName: 'Perplexity',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
    baseUrl: 'https://api.perplexity.ai',
    models: [
      // Sonar Pro is a web-search-augmented model — excellent for up-to-date factual queries
      { id: 'sonar-pro', displayName: 'Sonar Pro', contextWindow: 200_000, strengths: ['factual'] }
    ],
    rpmLimit: 10,
    tpmLimit: 100_000,
    dailyTokenLimit: 200_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'xai',
    displayName: 'xAI Grok',
    apiKeyEnv: 'XAI_API_KEY',
    baseUrl: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-2-1212', displayName: 'Grok 2', contextWindow: 131_072, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use', 'vision'] }
    ],
    rpmLimit: 10,
    tpmLimit: 100_000,
    dailyTokenLimit: 100_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'eden',
    displayName: 'Eden AI',
    apiKeyEnv: 'EDEN_API_KEY',
    baseUrl: 'https://api.edenai.run/v2',
    models: [
      { id: 'openai/gpt-4o-mini', displayName: 'GPT-4o Mini (via Eden)', contextWindow: 128_000, strengths: ['code', 'creative', 'factual'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 10,
    tpmLimit: 50_000,
    dailyTokenLimit: 50_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'siliconflow',
    displayName: 'SiliconFlow',
    apiKeyEnv: 'SILICONFLOW_API_KEY',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      { id: 'Qwen/Qwen2.5-7B-Instruct', displayName: 'Qwen 2.5 7B', contextWindow: 32_768, strengths: ['factual', 'code'], capabilities: ['tool_use'] },
      { id: 'black-forest-labs/FLUX.1-schnell', displayName: 'FLUX.1 Schnell', contextWindow: 4000, strengths: ['creative'], capabilities: ['image'] }
    ],
    rpmLimit: 10,
    tpmLimit: 50_000,
    dailyTokenLimit: 100_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'cerebras',
    displayName: 'Cerebras',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: [
      { id: 'llama-3.3-70b', displayName: 'Llama 3.3 70B', contextWindow: 128_000, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 5,
    tpmLimit: 30_000,
    dailyTokenLimit: 1_000_000,
    tier: 1,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'huggingface',
    displayName: 'HuggingFace',
    apiKeyEnv: 'HUGGINGFACE_API_KEY',
    baseUrl: 'https://api-inference.huggingface.co/models',
    models: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct', displayName: 'Llama 3.3 70B', contextWindow: 131_072, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', displayName: 'Mistral 7B', contextWindow: 32_768, strengths: ['factual'] }
    ],
    rpmLimit: 10,
    tpmLimit: 50_000,
    dailyTokenLimit: 100_000,
    tier: 1,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'cloudflare',
    displayName: 'Cloudflare',
    apiKeyEnv: 'CLOUDFLARE_API_KEY',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    models: [
      { id: '@cf/meta/llama-3.3-70b-instruct-fp8', displayName: 'Llama 3.3 70B', contextWindow: 131_072, strengths: ['factual', 'code'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 10,
    tpmLimit: 50_000,
    dailyTokenLimit: 100_000,
    tier: 1,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'dashscope',
    displayName: 'DashScope (Qwen)',
    apiKeyEnv: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-plus', displayName: 'Qwen Plus', contextWindow: 131_072, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] },
      { id: 'qwen-turbo', displayName: 'Qwen Turbo', contextWindow: 1_000_000, strengths: ['factual', 'long_doc'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 60,
    tpmLimit: 500_000,
    dailyTokenLimit: 500_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'ai21',
    displayName: 'AI21 Labs',
    apiKeyEnv: 'AI21_API_KEY',
    baseUrl: 'https://api.ai21.com/studio/v1',
    models: [
      { id: 'jamba-1.5-mini', displayName: 'Jamba 1.5 Mini', contextWindow: 256_000, strengths: ['factual', 'creative', 'long_doc'] },
      { id: 'jamba-1.5-large', displayName: 'Jamba 1.5 Large', contextWindow: 256_000, strengths: ['code', 'creative', 'factual', 'long_doc'] }
    ],
    rpmLimit: 10,
    tpmLimit: 100_000,
    dailyTokenLimit: 200_000,
    tier: 2,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'sambanova',
    displayName: 'SambaNova Cloud',
    apiKeyEnv: 'SAMBANOVA_API_KEY',
    baseUrl: 'https://api.sambanova.ai/v1',
    models: [
      { id: 'Meta-Llama-3.1-8B-Instruct', displayName: 'Llama 3.1 8B', contextWindow: 16_000, strengths: ['factual', 'code'], capabilities: ['tool_use'] },
      { id: 'Meta-Llama-3.1-70B-Instruct', displayName: 'Llama 3.1 70B', contextWindow: 16_000, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] },
      { id: 'Meta-Llama-3.1-405B-Instruct', displayName: 'Llama 3.1 405B', contextWindow: 16_000, strengths: ['factual', 'code', 'creative', 'long_doc'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 20,
    tpmLimit: 200_000,
    dailyTokenLimit: 500_000,
    tier: 1,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'deepinfra',
    displayName: 'DeepInfra',
    apiKeyEnv: 'DEEPINFRA_API_KEY',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    models: [
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', displayName: 'Llama 3.1 8B', contextWindow: 131_072, strengths: ['factual', 'code'], capabilities: ['tool_use'] },
      { id: 'Qwen/Qwen2.5-72B-Instruct', displayName: 'Qwen 2.5 72B', contextWindow: 32_768, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 10,
    tpmLimit: 100_000,
    dailyTokenLimit: 200_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'stability',
    displayName: 'Stability AI',
    apiKeyEnv: 'STABILITY_API_KEY',
    baseUrl: 'https://api.stability.ai/v1',
    models: [
      { id: 'stable-diffusion-xl-1024-v1-0', displayName: 'Stable Diffusion XL', contextWindow: 4000, strengths: ['creative'], capabilities: ['image'] }
    ],
    rpmLimit: 10,
    tpmLimit: 50_000,
    dailyTokenLimit: 100_000,
    tier: 2,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'replicate',
    displayName: 'Replicate',
    apiKeyEnv: 'REPLICATE_API_KEY',
    baseUrl: 'https://api.replicate.com/v1',
    models: [
      { id: 'black-forest-labs/flux-schnell', displayName: 'Flux Schnell', contextWindow: 4000, strengths: ['creative'], capabilities: ['image'] }
    ],
    rpmLimit: 10,
    tpmLimit: 50_000,
    dailyTokenLimit: 100_000,
    tier: 2,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'pollinations',
    displayName: 'Pollinations.ai',
    apiKeyEnv: 'POLLINATIONS_API_KEY',
    baseUrl: 'https://text.pollinations.ai',
    noKeyRequired: true,
    models: [
      { id: 'pollinations-text', displayName: 'Pollinations Text', contextWindow: 4_000, strengths: ['factual', 'creative'] },
      { id: 'pollinations-image', displayName: 'Pollinations Image', contextWindow: 4_000, strengths: ['creative'], capabilities: ['image'] }
    ],
    rpmLimit: 20,
    tpmLimit: 100_000,
    dailyTokenLimit: 200_000,
    tier: 1,
    adapter: 'native',
    enabled: true
  },
  {
    name: 'volcengine',
    displayName: 'Volcengine (Doubao)',
    apiKeyEnv: 'VOLCENGINE_API_KEY',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      { id: 'doubao-lite-4k', displayName: 'Doubao Lite', contextWindow: 4_000, strengths: ['factual'] },
      { id: 'doubao-pro-32k', displayName: 'Doubao Pro', contextWindow: 32_000, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 30,
    tpmLimit: 500_000,
    dailyTokenLimit: 1_000_000,
    tier: 1,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'zhipu',
    displayName: 'Zhipu AI (GLM)',
    apiKeyEnv: 'ZHIPU_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-4-flash', displayName: 'GLM-4 Flash', contextWindow: 128_000, strengths: ['factual', 'code'], capabilities: ['tool_use'] },
      { id: 'glm-4-air', displayName: 'GLM-4 Air', contextWindow: 128_000, strengths: ['factual', 'code', 'creative'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 20,
    tpmLimit: 200_000,
    dailyTokenLimit: 500_000,
    tier: 1,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'baidu',
    displayName: 'Baidu Qianfan (ERNIE)',
    apiKeyEnv: 'BAIDU_API_KEY',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    models: [
      { id: 'ernie-speed-8k', displayName: 'ERNIE Speed', contextWindow: 8_000, strengths: ['factual'] },
      { id: 'ernie-4.0-8k', displayName: 'ERNIE 4.0', contextWindow: 8_000, strengths: ['factual', 'code', 'creative'] }
    ],
    rpmLimit: 20,
    tpmLimit: 200_000,
    dailyTokenLimit: 500_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'moonshot',
    displayName: 'Moonshot AI (Kimi)',
    apiKeyEnv: 'MOONSHOT_API_KEY',
    baseUrl: 'https://api.moonshot.ai/v1',
    models: [
      { id: 'moonshot-v1-32k', displayName: 'Kimi 32K', contextWindow: 32_000, strengths: ['factual', 'long_doc'], capabilities: ['tool_use'] },
      { id: 'moonshot-v1-128k', displayName: 'Kimi 128K', contextWindow: 128_000, strengths: ['factual', 'long_doc', 'code'], capabilities: ['tool_use'] }
    ],
    rpmLimit: 10,
    tpmLimit: 200_000,
    dailyTokenLimit: 200_000,
    tier: 2,
    adapter: 'openai-compatible',
    enabled: true
  },
  {
    name: 'falai',
    displayName: 'Fal.ai',
    apiKeyEnv: 'FALAI_API_KEY',
    baseUrl: 'https://fal.run',
    models: [
      { id: 'fal-ai/flux/schnell', displayName: 'Flux Schnell', contextWindow: 4000, strengths: ['creative'], capabilities: ['image'] }
    ],
    rpmLimit: 10,
    tpmLimit: 50_000,
    dailyTokenLimit: 100_000,
    tier: 2,
    adapter: 'native',
    enabled: true
  }
]

export function getProviderConfig(name: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS.find((p) => p.name === name)
}

export function getEnabledProviders(): ProviderConfig[] {
  return PROVIDER_CONFIGS.filter((p) => p.enabled)
}

function isImageOnlyModel(m: ProviderConfig['models'][number]): boolean {
  return m.capabilities?.length === 1 && m.capabilities[0] === 'image'
}

/** Excludes providers whose every model is image-generation-only (e.g. Stability AI, Replicate, Fal.ai). */
export function getChatProviders(): ProviderConfig[] {
  return PROVIDER_CONFIGS.filter((p) => p.enabled && p.models.some((m) => !isImageOnlyModel(m)))
}

export function getImageCapableProviders(): ProviderConfig[] {
  return PROVIDER_CONFIGS.filter((p) => p.enabled && p.models.some((m) => m.capabilities?.includes('image')))
}

/** Returns providers that have at least one model with tool_use capability — required for coding agents. */
export function getToolUseCapableProviders(): ProviderConfig[] {
  return PROVIDER_CONFIGS.filter((p) => p.enabled && p.models.some((m) => m.capabilities?.includes('tool_use')))
}

/** Returns providers that have at least one model with vision capability. */
export function getVisionCapableProviders(): ProviderConfig[] {
  return PROVIDER_CONFIGS.filter((p) => p.enabled && p.models.some((m) => m.capabilities?.includes('vision')))
}
