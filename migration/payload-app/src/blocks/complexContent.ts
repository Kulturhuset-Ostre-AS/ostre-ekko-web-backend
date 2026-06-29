import type { Block } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

// Craft Matrix `complexContent` -> Payload blocks. One block per Craft entry type.
// blockType discriminator is Payload's `blockType` (mirrors Craft's typeHandle alias).

export const TextBlock: Block = {
  slug: 'text2',
  labels: { singular: 'Text', plural: 'Text blocks' },
  fields: [{ name: 'text', type: 'richText', editor: lexicalEditor() }],
}

export const VideoBlock: Block = {
  slug: 'video',
  labels: { singular: 'Video', plural: 'Video blocks' },
  fields: [{ name: 'videoUrl', type: 'text', label: 'Video URL' }],
}

export const EmbedBlock: Block = {
  slug: 'embed',
  labels: { singular: 'Embed', plural: 'Embed blocks' },
  fields: [{ name: 'code', type: 'textarea', label: 'Embed code' }],
}

export const ImageBlock: Block = {
  slug: 'imageBlock',
  labels: { singular: 'Image', plural: 'Image blocks' },
  fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
}

export const complexContentBlocks: Block[] = [TextBlock, VideoBlock, EmbedBlock, ImageBlock]
