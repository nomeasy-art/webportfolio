import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'collaborator',
      title: 'Collaborator',
      type: 'string',
      description: 'e.g. W/ NOME COLLABORATORE-TRICE'
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'string',
      description: 'e.g. 2026'
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: {
        list: [
          {title: 'Editorial', value: 'editorial'},
          {title: 'Packaging', value: 'packaging'},
          {title: 'Book Cover', value: 'book-cover'},
          {title: 'User Interface', value: 'user-interface'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'mainImage',
      title: 'Main Image',
      type: 'image',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'galleryImages',
      title: 'Gallery Images',
      type: 'array',
      of: [{type: 'image'}],
      options: {
        layout: 'grid',
      },
    }),
    defineField({
      name: 'externalLink',
      title: 'External Link',
      type: 'url',
    }),
    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: 'Order in the list (smaller number = higher up)',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'category',
      media: 'mainImage',
    },
  },
})
