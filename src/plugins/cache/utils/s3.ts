// S3 工具模块
// S3 兼容存储的上传工具函数

import { createHash, createHmac } from 'crypto'

/** S3 配置接口 */
export interface S3Config {
  endpoint?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  bucket?: string
  publicBaseUrl?: string
  forcePathStyle?: boolean
  acl?: 'private' | 'public-read'
}

/** 格式化日期为 AWS 格式 */
function toAmzDate(d: Date): string {
  const pad = (n: number, w = 2) => n.toString().padStart(w, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

/** 计算 SHA256 哈希（十六进制） */
function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

/** 计算 HMAC（返回 Buffer） */
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

/** 计算 HMAC（返回十六进制） */
function hmacHex(key: Buffer | string, data: string): string {
  return createHmac('sha256', key).update(data, 'utf8').digest('hex')
}

/** 获取 AWS 签名密钥 */
function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  regionName: string,
  serviceName: string
): Buffer {
  const kDate = hmac('AWS4' + secretKey, dateStamp)
  const kRegion = hmac(kDate, regionName)
  const kService = hmac(kRegion, serviceName)
  return hmac(kService, 'aws4_request')
}

/** 去除多余空格 */
function trimSpaces(str: string): string {
  return str.replace(/\s+/g, ' ').trim()
}

/** URL 编码路径中的每个部分 */
function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

/** 拼接 URL 和路径 */
function joinUrl(base: string, key: string): string {
  const b = base.replace(/\/$/, '')
  return `${b}/${encodeKey(key)}`
}

/** 构建 S3 主机和路径信息 */
function buildS3HostAndPath(
  config: S3Config,
  key: string
): { host: string; url: string; canonicalUri: string } {
  let base: URL
  if (config.endpoint) {
    base = new URL(config.endpoint)
  } else {
    base = new URL(`https://s3.${config.region || 'us-east-1'}.amazonaws.com`)
  }

  const bucket = config.bucket!
  const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(base.hostname)
  const hasPort = !!base.port
  const isLocal = base.hostname === 'localhost'
  const preferPath = isIp || hasPort || isLocal
  const usePath = !!config.forcePathStyle || preferPath

  const hostname = base.hostname
  const port = base.port ? `:${base.port}` : ''
  let host = hostname + port
  let path = ''
  if (usePath) {
    path = `/${bucket}/${encodeKey(key)}`
  } else {
    host = `${bucket}.${hostname}${port}`
    path = `/${encodeKey(key)}`
  }

  const url = `${base.protocol}//${host}${path}`
  const canonicalUri = path
  return { host, url, canonicalUri }
}

/**
 * 上传文件到 S3 兼容存储
 */
export async function uploadToS3(
  buffer: Buffer,
  filename: string,
  mime: string,
  config: S3Config
): Promise<{ url: string; key: string }> {
  const bucket = config.bucket
  const region = config.region || 'us-east-1'
  const accessKeyId = config.accessKeyId
  const secretAccessKey = config.secretAccessKey

  if (!bucket) throw new Error('S3 缺少 bucket 配置')
  if (!accessKeyId || !secretAccessKey) throw new Error('S3 需提供访问凭证')

  const now = new Date()
  const amzDate = toAmzDate(now)
  const dateStamp = amzDate.slice(0, 8)

  const key = filename
  const hostInfo = buildS3HostAndPath(config, key)
  const { host, url, canonicalUri } = hostInfo

  const payloadHash = sha256Hex(buffer)
  const headers: Record<string, string> = {
    'host': host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  if (mime) headers['content-type'] = mime
  if (config.acl) headers['x-amz-acl'] = config.acl

  const signedHeaders = Object.keys(headers)
    .map(k => k.toLowerCase())
    .sort()
    .join(';')
  const canonicalHeaders = Object.keys(headers)
    .map(k => k.toLowerCase())
    .sort()
    .map(k => `${k}:${trimSpaces(String(headers[k]))}\n`)
    .join('')

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256Hex(Buffer.from(canonicalRequest, 'utf8')),
  ].join('\n')

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, 's3')
  const signature = hmacHex(signingKey, stringToSign)
  const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const reqHeaders: Record<string, string> = { ...headers, Authorization: authorization }

  const resp = await fetch(url, {
    method: 'PUT',
    headers: reqHeaders as any,
    body: new Uint8Array(buffer)
  })
  if (!resp.ok) throw new Error(`S3 上传失败: ${resp.status}`)

  const publicUrl = config.publicBaseUrl
    ? joinUrl(config.publicBaseUrl, key)
    : url
  return { url: publicUrl, key }
}
