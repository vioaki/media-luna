// Edge TTS 连接器配置

import type { ConnectorField, CardDisplayField } from '../../core'

/** 中文音色 */
const chineseVoiceOptions = [
  // 普通话 - 女声
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaoyiNeural', label: '晓依 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaochenNeural', label: '晓辰 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaohanNeural', label: '晓涵 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaomengNeural', label: '晓梦 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaomoNeural', label: '晓墨 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaoqiuNeural', label: '晓秋 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaoruiNeural', label: '晓睿 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaoshuangNeural', label: '晓双 (女童)', group: '中文-女声' },
  { value: 'zh-CN-XiaoxuanNeural', label: '晓萱 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaoyanNeural', label: '晓颜 (女)', group: '中文-女声' },
  { value: 'zh-CN-XiaoyouNeural', label: '晓悠 (女童)', group: '中文-女声' },
  { value: 'zh-CN-XiaozhenNeural', label: '晓甄 (女)', group: '中文-女声' },
  // 普通话 - 男声
  { value: 'zh-CN-YunxiNeural', label: '云希 (男)', group: '中文-男声' },
  { value: 'zh-CN-YunjianNeural', label: '云健 (男)', group: '中文-男声' },
  { value: 'zh-CN-YunyangNeural', label: '云扬 (男)', group: '中文-男声' },
  { value: 'zh-CN-YunxiaNeural', label: '云夏 (男童)', group: '中文-男声' },
  { value: 'zh-CN-YunfengNeural', label: '云枫 (男)', group: '中文-男声' },
  { value: 'zh-CN-YunhaoNeural', label: '云皓 (男)', group: '中文-男声' },
  { value: 'zh-CN-YunzeNeural', label: '云泽 (男)', group: '中文-男声' },
  // 粤语
  { value: 'zh-HK-HiuMaanNeural', label: '晓曼 (女)', group: '粤语' },
  { value: 'zh-HK-HiuGaaiNeural', label: '晓佳 (女)', group: '粤语' },
  { value: 'zh-HK-WanLungNeural', label: '云龙 (男)', group: '粤语' },
  // 台湾
  { value: 'zh-TW-HsiaoChenNeural', label: '晓臻 (女)', group: '台湾' },
  { value: 'zh-TW-HsiaoYuNeural', label: '晓雨 (女)', group: '台湾' },
  { value: 'zh-TW-YunJheNeural', label: '云哲 (男)', group: '台湾' },
]

/** 日语音色 */
const japaneseVoiceOptions = [
  { value: 'ja-JP-NanamiNeural', label: 'Nanami (女)', group: '日语' },
  { value: 'ja-JP-AoiNeural', label: 'Aoi (女)', group: '日语' },
  { value: 'ja-JP-MayuNeural', label: 'Mayu (女)', group: '日语' },
  { value: 'ja-JP-ShioriNeural', label: 'Shiori (女)', group: '日语' },
  { value: 'ja-JP-KeitaNeural', label: 'Keita (男)', group: '日语' },
  { value: 'ja-JP-DaichiNeural', label: 'Daichi (男)', group: '日语' },
  { value: 'ja-JP-NaokiNeural', label: 'Naoki (男)', group: '日语' },
]

/** 英语音色 */
const englishVoiceOptions = [
  // 美式英语
  { value: 'en-US-AvaNeural', label: 'Ava (女)', group: '美式英语' },
  { value: 'en-US-EmmaNeural', label: 'Emma (女)', group: '美式英语' },
  { value: 'en-US-JennyNeural', label: 'Jenny (女)', group: '美式英语' },
  { value: 'en-US-MichelleNeural', label: 'Michelle (女)', group: '美式英语' },
  { value: 'en-US-AriaNeural', label: 'Aria (女)', group: '美式英语' },
  { value: 'en-US-AnaNeural', label: 'Ana (女童)', group: '美式英语' },
  { value: 'en-US-AndrewNeural', label: 'Andrew (男)', group: '美式英语' },
  { value: 'en-US-BrianNeural', label: 'Brian (男)', group: '美式英语' },
  { value: 'en-US-ChristopherNeural', label: 'Christopher (男)', group: '美式英语' },
  { value: 'en-US-EricNeural', label: 'Eric (男)', group: '美式英语' },
  { value: 'en-US-GuyNeural', label: 'Guy (男)', group: '美式英语' },
  { value: 'en-US-RogerNeural', label: 'Roger (男)', group: '美式英语' },
  { value: 'en-US-SteffanNeural', label: 'Steffan (男)', group: '美式英语' },
  // 英式英语
  { value: 'en-GB-SoniaNeural', label: 'Sonia (女)', group: '英式英语' },
  { value: 'en-GB-LibbyNeural', label: 'Libby (女)', group: '英式英语' },
  { value: 'en-GB-MaisieNeural', label: 'Maisie (女童)', group: '英式英语' },
  { value: 'en-GB-RyanNeural', label: 'Ryan (男)', group: '英式英语' },
  { value: 'en-GB-ThomasNeural', label: 'Thomas (男)', group: '英式英语' },
]

/** 韩语音色 */
const koreanVoiceOptions = [
  { value: 'ko-KR-SunHiNeural', label: 'SunHi (女)', group: '韩语' },
  { value: 'ko-KR-JiMinNeural', label: 'JiMin (女)', group: '韩语' },
  { value: 'ko-KR-SeoHyeonNeural', label: 'SeoHyeon (女)', group: '韩语' },
  { value: 'ko-KR-SoonBokNeural', label: 'SoonBok (女)', group: '韩语' },
  { value: 'ko-KR-YuJinNeural', label: 'YuJin (女)', group: '韩语' },
  { value: 'ko-KR-InJoonNeural', label: 'InJoon (男)', group: '韩语' },
  { value: 'ko-KR-BongJinNeural', label: 'BongJin (男)', group: '韩语' },
  { value: 'ko-KR-GookMinNeural', label: 'GookMin (男)', group: '韩语' },
  { value: 'ko-KR-HyunsuNeural', label: 'Hyunsu (男)', group: '韩语' },
]

/** 其他语言音色 */
const otherVoiceOptions = [
  // 法语
  { value: 'fr-FR-DeniseNeural', label: 'Denise (女)', group: '法语' },
  { value: 'fr-FR-HenriNeural', label: 'Henri (男)', group: '法语' },
  // 德语
  { value: 'de-DE-KatjaNeural', label: 'Katja (女)', group: '德语' },
  { value: 'de-DE-ConradNeural', label: 'Conrad (男)', group: '德语' },
  // 西班牙语
  { value: 'es-ES-ElviraNeural', label: 'Elvira (女)', group: '西班牙语' },
  { value: 'es-ES-AlvaroNeural', label: 'Alvaro (男)', group: '西班牙语' },
  // 俄语
  { value: 'ru-RU-SvetlanaNeural', label: 'Svetlana (女)', group: '俄语' },
  { value: 'ru-RU-DmitryNeural', label: 'Dmitry (男)', group: '俄语' },
  // 意大利语
  { value: 'it-IT-ElsaNeural', label: 'Elsa (女)', group: '意大利语' },
  { value: 'it-IT-DiegoNeural', label: 'Diego (男)', group: '意大利语' },
  // 葡萄牙语
  { value: 'pt-BR-FranciscaNeural', label: 'Francisca (女)', group: '葡萄牙语' },
  { value: 'pt-BR-AntonioNeural', label: 'Antonio (男)', group: '葡萄牙语' },
]

/** 所有音色选项 */
export const allVoiceOptions = [
  ...chineseVoiceOptions,
  ...japaneseVoiceOptions,
  ...englishVoiceOptions,
  ...koreanVoiceOptions,
  ...otherVoiceOptions
]

/** Edge TTS 配置字段 */
export const connectorFields: ConnectorField[] = [
  {
    key: 'voice',
    label: '音色',
    type: 'combobox',
    required: false,
    default: 'zh-CN-XiaoxiaoNeural',
    placeholder: '选择预设音色或输入音色 ID',
    options: allVoiceOptions,
    description: '选择音色，完整列表可访问微软文档'
  },
  {
    key: 'rate',
    label: '语速',
    type: 'select',
    required: false,
    default: 'default',
    options: [
      { value: 'default', label: '默认' },
      { value: 'x-slow', label: '极慢' },
      { value: 'slow', label: '慢' },
      { value: 'medium', label: '中等' },
      { value: 'fast', label: '快' },
      { value: 'x-fast', label: '极快' }
    ],
    description: '语速调整'
  },
  {
    key: 'volume',
    label: '音量',
    type: 'select',
    required: false,
    default: 'default',
    options: [
      { value: 'default', label: '默认' },
      { value: 'silent', label: '静音' },
      { value: 'x-soft', label: '极轻' },
      { value: 'soft', label: '轻' },
      { value: 'medium', label: '中等' },
      { value: 'loud', label: '响' },
      { value: 'x-loud', label: '极响' }
    ],
    description: '音量调整'
  },
  {
    key: 'pitch',
    label: '音调',
    type: 'select',
    required: false,
    default: 'default',
    options: [
      { value: 'default', label: '默认' },
      { value: 'x-low', label: '极低' },
      { value: 'low', label: '低' },
      { value: 'medium', label: '中等' },
      { value: 'high', label: '高' },
      { value: 'x-high', label: '极高' }
    ],
    description: '音调调整'
  }
]

/** 卡片展示字段 */
export const connectorCardFields: CardDisplayField[] = [
  { source: 'connectorConfig', key: 'voice', label: '音色' }
]
