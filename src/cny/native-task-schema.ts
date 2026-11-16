// Extracted read-only from official new-api rc50 f2aa91232ed3e5878a614762ace6736a2b74257f; no plugin code is installed.
export const NATIVE_TASK_SCHEMA = {
  sourceSha: 'f2aa91232ed3e5878a614762ace6736a2b74257f',
  plugins: {
    alibaba: {
      models: [
        'wan3.0-video',
        'wan3.0-video-prime',
        'wan2.7-t2v',
        'wan2.7-t2v-2026-04-25',
        'wan2.7-t2v-2026-06-12',
        'wan2.7-i2v',
        'wan2.7-i2v-2026-04-25',
        'wan2.6-t2v',
        'wan2.6-t2v-us',
        'wan2.6-i2v',
        'wan2.6-i2v-flash',
        'wan2.6-i2v-us',
        'wan2.5-t2v-preview',
        'wan2.5-i2v-preview',
        'wan2.2-t2v-plus',
        'wan2.2-i2v-flash',
        'wan2.2-i2v-plus',
        'wan2.2-kf2v-flash',
        'wan2.2-s2v',
        'wanx2.1-t2v-plus',
        'wanx2.1-t2v-turbo',
        'wanx2.1-i2v-plus',
        'wanx2.1-i2v-turbo',
        'wan2.7-image-pro',
        'wan2.7-image',
        'wan2.6-image',
        'wan2.6-t2i',
        'wan2.5-t2i-preview',
        'wan2.2-t2i-flash',
        'wan2.2-t2i-plus',
        'wanx2.1-t2i-turbo',
        'wanx2.1-t2i-plus',
        'wanx2.0-t2i-turbo',
        'wan2.5-i2i-preview',
        'wanx2.1-imageedit',
        'qwen-image',
        'qwen-image-plus',
        'qwen-image-max',
        'qwen-image-2.0',
        'qwen-image-2.0-pro',
        'qwen-image-3.0',
        'qwen-image-3.0-pro',
        'qwen-image-edit',
        'qwen-image-edit-plus',
        'qwen-image-edit-max',
        'z-image-turbo',
        'qwen-image-plus-2026-01-09',
        'qwen-image-max-2025-12-30',
        'qwen-image-2.0-2026-03-03',
        'qwen-image-2.0-pro-2026-03-03',
        'qwen-image-2.0-pro-2026-04-22',
        'qwen-image-2.0-pro-2026-06-22',
        'qwen-image-edit-plus-2025-10-30',
        'qwen-image-edit-plus-2025-12-15',
        'qwen-image-edit-max-2026-01-16',
      ],
      schema: {
        image_count: {
          type: 'number',
          unit: 'count',
        },
        seconds: {
          type: 'number',
          unit: 'second',
        },
        resolution: {
          enum: ['480P', '720P', '1080P'],
        },
      },
      profiles: [
        {
          models: [
            'wan2.7-image-pro',
            'wan2.7-image',
            'wan2.6-image',
            'wan2.6-t2i',
            'wan2.5-t2i-preview',
            'wan2.2-t2i-flash',
            'wan2.2-t2i-plus',
            'wanx2.1-t2i-turbo',
            'wanx2.1-t2i-plus',
            'wanx2.0-t2i-turbo',
            'wan2.5-i2i-preview',
            'wanx2.1-imageedit',
            'qwen-image',
            'qwen-image-plus',
            'qwen-image-max',
            'qwen-image-2.0',
            'qwen-image-2.0-pro',
            'qwen-image-edit',
            'qwen-image-edit-plus',
            'qwen-image-edit-max',
            'qwen-image-plus-2026-01-09',
            'qwen-image-max-2025-12-30',
            'qwen-image-2.0-2026-03-03',
            'qwen-image-2.0-pro-2026-03-03',
            'qwen-image-2.0-pro-2026-04-22',
            'qwen-image-2.0-pro-2026-06-22',
            'qwen-image-edit-plus-2025-10-30',
            'qwen-image-edit-plus-2025-12-15',
            'qwen-image-edit-max-2026-01-16',
          ],
          schema: {
            image_count: {
              type: 'number',
              unit: 'count',
            },
          },
        },
        {
          models: ['z-image-turbo'],
          schema: {
            image_count: {
              type: 'number',
              unit: 'count',
            },
            prompt_extend: {
              type: 'boolean',
            },
          },
        },
        {
          models: ['qwen-image-3.0', 'qwen-image-3.0-pro'],
          schema: {
            image_count: {
              type: 'number',
              unit: 'count',
            },
            output_image_type: {
              enum: ['qima_output_1k', 'qima_output_2k'],
            },
            input_image_count: {
              type: 'number',
              unit: 'count',
            },
          },
        },
        {
          models: [
            'wan3.0-video',
            'wan3.0-video-prime',
            'wan2.5-t2v-preview',
            'wan2.5-i2v-preview',
            'wan2.2-i2v-flash',
            'wan2.2-kf2v-flash',
          ],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['480P', '720P', '1080P'],
            },
          },
        },
        {
          models: [
            'wan2.7-t2v',
            'wan2.7-i2v',
            'wan2.6-t2v',
            'wan2.6-t2v-us',
            'wan2.6-i2v',
            'wan2.6-i2v-us',
            'wan2.7-t2v-2026-04-25',
            'wan2.7-t2v-2026-06-12',
            'wan2.7-i2v-2026-04-25',
          ],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['720P', '1080P'],
            },
          },
        },
        {
          models: ['wan2.6-i2v-flash'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['720P', '1080P'],
            },
            audio: {
              type: 'boolean',
            },
          },
        },
        {
          models: ['wan2.2-t2v-plus', 'wan2.2-i2v-plus'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['480P', '1080P'],
            },
          },
        },
        {
          models: ['wan2.2-s2v', 'wanx2.1-t2v-turbo', 'wanx2.1-i2v-turbo'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['480P', '720P'],
            },
          },
        },
        {
          models: ['wanx2.1-t2v-plus', 'wanx2.1-i2v-plus'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['720P'],
            },
          },
        },
      ],
      source: 'plugins/tasks/alibaba/plugin.js',
      version: '1.5.0',
    },
    doubao: {
      models: [
        'doubao-seedance-1-0-pro-250528',
        'doubao-seedance-1-0-lite-t2v',
        'doubao-seedance-1-0-lite-i2v',
        'doubao-seedance-1-5-pro-251215',
        'doubao-seedance-2-0-260128',
        'doubao-seedance-2-0-fast-260128',
        'doubao-seedance-2-0-mini-260615',
        'doubao-seedance-2-5-260628',
        'doubao-seedream-5-0-pro-260628',
        'doubao-seedream-5-0-flash-260915',
        'doubao-seedream-5-0-lite-260128',
        'doubao-seedream-5-0-260128',
        'doubao-seedream-4-5-251128',
        'doubao-seedream-4-0-250828',
      ],
      schema: {
        tokens: {
          type: 'number',
          unit: 'token',
        },
        resolution: {
          enum: ['480p', '720p', '1080p', '4k'],
        },
        video_input: {
          enum: ['none', 'video'],
        },
      },
      profiles: [
        {
          models: [
            'doubao-seedance-1-0-pro-250528',
            'doubao-seedance-1-0-lite-t2v',
            'doubao-seedance-1-0-lite-i2v',
          ],
          schema: {
            tokens: {
              type: 'number',
              unit: 'token',
            },
            resolution: {
              enum: ['480p', '720p', '1080p'],
            },
          },
        },
        {
          models: ['doubao-seedance-1-5-pro-251215'],
          schema: {
            tokens: {
              type: 'number',
              unit: 'token',
            },
            resolution: {
              enum: ['480p', '720p', '1080p'],
            },
            generate_audio: {
              type: 'boolean',
            },
          },
        },
        {
          models: ['doubao-seedance-2-0-260128'],
          schema: {
            tokens: {
              type: 'number',
              unit: 'token',
            },
            resolution: {
              enum: ['480p', '720p', '1080p', '4k'],
            },
            video_input: {
              enum: ['none', 'video'],
            },
          },
        },
        {
          models: ['doubao-seedance-2-0-fast-260128', 'doubao-seedance-2-0-mini-260615'],
          schema: {
            tokens: {
              type: 'number',
              unit: 'token',
            },
            resolution: {
              enum: ['480p', '720p'],
            },
            video_input: {
              enum: ['none', 'video'],
            },
          },
        },
        {
          models: ['doubao-seedance-2-5-260628'],
          schema: {
            tokens: {
              type: 'number',
              unit: 'token',
            },
            resolution: {
              enum: ['480p', '720p', '1080p'],
            },
            video_input: {
              enum: ['none', 'video'],
            },
          },
        },
        {
          models: ['doubao-seedream-5-0-pro-260628', 'doubao-seedream-5-0-flash-260915'],
          schema: {
            images_up_to_1_5k: {
              type: 'number',
              unit: 'count',
            },
            images_above_1_5k: {
              type: 'number',
              unit: 'count',
            },
            input_images: {
              type: 'number',
              unit: 'count',
            },
            layer_decomposition: {
              type: 'boolean',
            },
          },
        },
        {
          models: [
            'doubao-seedream-5-0-lite-260128',
            'doubao-seedream-5-0-260128',
            'doubao-seedream-4-5-251128',
          ],
          schema: {
            images_above_1_5k: {
              type: 'number',
              unit: 'count',
            },
            input_images: {
              type: 'number',
              unit: 'count',
            },
          },
        },
        {
          models: ['doubao-seedream-4-0-250828'],
          schema: {
            images_up_to_1_5k: {
              type: 'number',
              unit: 'count',
            },
            images_above_1_5k: {
              type: 'number',
              unit: 'count',
            },
            input_images: {
              type: 'number',
              unit: 'count',
            },
          },
        },
      ],
      source: 'plugins/tasks/doubao/plugin.js',
      version: '1.4.0',
    },
    google: {
      models: [
        'veo-3.0-generate-001',
        'veo-3.0-fast-generate-001',
        'veo-3.1-generate-preview',
        'veo-3.1-fast-generate-preview',
      ],
      schema: {
        seconds: {
          type: 'number',
          unit: 'second',
        },
        resolution: {
          enum: ['720p', '1080p', '4k'],
        },
      },
      profiles: [],
      source: 'plugins/tasks/google/plugin.js',
      version: '1.2.0',
    },
    hailuo: {
      models: [
        'MiniMax-H3',
        'MiniMax-Hailuo-2.3',
        'MiniMax-Hailuo-2.3-Fast',
        'MiniMax-Hailuo-02',
        'T2V-01-Director',
        'T2V-01',
        'I2V-01-Director',
        'I2V-01-live',
        'I2V-01',
        'S2V-01',
      ],
      schema: {
        seconds: {
          type: 'number',
          unit: 'second',
        },
        resolution: {
          enum: ['512P', '768P', '720P', '1080P', '2K'],
        },
        input_images: {
          type: 'number',
          unit: 'count',
        },
        input_video_seconds: {
          type: 'number',
          unit: 'second',
        },
      },
      profiles: [
        {
          models: ['MiniMax-H3'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['768P', '2K'],
            },
            input_images: {
              type: 'number',
              unit: 'count',
            },
            input_video_seconds: {
              type: 'number',
              unit: 'second',
            },
          },
        },
        {
          models: ['MiniMax-Hailuo-2.3', 'MiniMax-Hailuo-2.3-Fast'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['768P', '1080P'],
            },
          },
        },
        {
          models: ['MiniMax-Hailuo-02'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['512P', '768P', '1080P'],
            },
          },
        },
        {
          models: [
            'T2V-01-Director',
            'T2V-01',
            'I2V-01-Director',
            'I2V-01-live',
            'I2V-01',
            'S2V-01',
          ],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
          },
        },
      ],
      source: 'plugins/tasks/hailuo/plugin.js',
      version: '1.4.0',
    },
    jimeng: {
      models: ['jimeng_vgfm_t2v_l20'],
      schema: {
        seconds: {
          type: 'number',
          unit: 'second',
        },
        product: {
          enum: ['s2_pro', 'v30_720p', 'v30_1080p', 'v30_pro'],
        },
      },
      profiles: [],
      source: 'plugins/tasks/jimeng/plugin.js',
      version: '1.2.0',
    },
    kling: {
      models: ['kling-v2-5-turbo', 'kling-v2-6', 'kling-v3', 'kling-4.0'],
      schema: {
        units: {
          type: 'number',
          unit: 'credit',
        },
      },
      profiles: [],
      source: 'plugins/tasks/kling/plugin.js',
      version: '1.2.0',
    },
    sora: {
      models: ['sora-2', 'sora-2-pro'],
      schema: {
        seconds: {
          type: 'number',
          unit: 'second',
        },
        size: {
          enum: ['720x1280', '1280x720', '1792x1024', '1024x1792'],
        },
      },
      profiles: [],
      source: 'plugins/tasks/sora/plugin.js',
      version: '1.1.0',
    },
    sunoapi: {
      models: ['suno_music', 'suno_lyrics'],
      schema: {
        clips: {
          type: 'number',
          unit: 'count',
        },
        action: {
          enum: ['music', 'lyrics'],
        },
      },
      profiles: [],
      source: 'plugins/tasks/sunoapi/plugin.js',
      version: '1.1.0',
    },
    'vertex-ai': {
      models: [
        'veo-3.0-generate-001',
        'veo-3.0-fast-generate-001',
        'veo-3.1-generate-preview',
        'veo-3.1-fast-generate-preview',
        'gemini-omni-1.2-flash',
        'gemini-omni-1.1-flash-preview',
        'gemini-omni-flash-preview',
      ],
      schema: {
        seconds: {
          type: 'number',
          unit: 'second',
        },
        resolution: {
          enum: ['720p', '1080p', '4k'],
        },
        generate_audio: {
          type: 'boolean',
        },
      },
      profiles: [
        {
          models: [
            'gemini-omni-1.2-flash',
            'gemini-omni-1.1-flash-preview',
            'gemini-omni-flash-preview',
          ],
          schema: {
            input_tokens: {
              type: 'number',
              unit: 'token',
            },
            output_tokens: {
              type: 'number',
              unit: 'token',
            },
            video_tokens: {
              type: 'number',
              unit: 'token',
            },
          },
        },
      ],
      source: 'plugins/tasks/vertex-ai/plugin.js',
      version: '1.3.1',
    },
    vidu: {
      models: [
        'viduq3-pro',
        'viduq3-turbo',
        'viduq3-pro-fast',
        'viduq3',
        'viduq3-mix',
        'viduq3-ad',
        'viduq3-drama',
        'viduq4-preview',
        'viduq2-pro',
        'viduq2-turbo',
        'viduq2-pro-fast',
        'viduq2',
        'viduq1-classic',
        'viduq1',
        'vidu2.0',
        'vidu1.5',
      ],
      schema: {
        credits: {
          type: 'number',
          unit: 'credit',
        },
        duration: {
          type: 'number',
          unit: 'second',
        },
        resolution: {
          enum: ['360p', '540p', '720p', '1080p', '2K', '4K'],
        },
      },
      profiles: [],
      source: 'plugins/tasks/vidu/plugin.js',
      version: '1.2.0',
    },
    xai: {
      models: ['grok-imagine-video', 'grok-imagine-video-1.5', 'grok-imagine-video-1.5-lite'],
      schema: {
        seconds: {
          type: 'number',
          unit: 'second',
        },
        resolution: {
          enum: ['480p', '720p', '1080p'],
        },
        input_images: {
          type: 'number',
          unit: 'count',
        },
        input_video_seconds: {
          type: 'number',
          unit: 'second',
        },
        moderated: {
          type: 'boolean',
        },
      },
      profiles: [
        {
          models: ['grok-imagine-video'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['480p', '720p'],
            },
            input_images: {
              type: 'number',
              unit: 'count',
            },
            input_video_seconds: {
              type: 'number',
              unit: 'second',
            },
            moderated: {
              type: 'boolean',
            },
          },
        },
        {
          models: ['grok-imagine-video-1.5', 'grok-imagine-video-1.5-lite'],
          schema: {
            seconds: {
              type: 'number',
              unit: 'second',
            },
            resolution: {
              enum: ['480p', '720p', '1080p'],
            },
            input_images: {
              type: 'number',
              unit: 'count',
            },
            moderated: {
              type: 'boolean',
            },
          },
        },
      ],
      source: 'plugins/tasks/xai/plugin.js',
      version: '1.2.0',
    },
  },
} as const;
