import type { CollectionConfig } from 'payload'
import { craftId } from '../fields/common'

// Single media collection replacing Craft's 4 asset volumes (artistPhotos,
// eventPhoto, mixtapes, userPhotos). `source` keeps the originating volume handle.
// `optimised` image size reproduces Craft's url(transform: "optimised").
export const Media: CollectionConfig = {
  slug: 'media',
  access: { read: () => true },
  upload: {
    staticDir: '../media-uploads',
    mimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
    imageSizes: [
      { name: 'optimised', width: 1600, height: undefined, position: 'centre' },
      { name: 'thumbnail', width: 400, height: undefined, position: 'centre' },
    ],
  },
  admin: { useAsTitle: 'filename' },
  fields: [
    craftId,
    { name: 'alt', type: 'text' },
    { name: 'artistName', type: 'text' },
    { name: 'ekstraInfo', type: 'text' },
    {
      name: 'source',
      type: 'select',
      admin: { position: 'sidebar', description: 'Originating Craft volume' },
      options: ['artistPhotos', 'eventPhoto', 'mixtapes', 'userPhotos'],
    },
  ],
}
