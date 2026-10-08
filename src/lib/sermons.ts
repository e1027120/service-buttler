import type {
  SermonRecord,
  SermonSlide,
  SermonSlideDefinition,
} from './types';
import { shortId } from './utils';

export function getDefaultSermonSlide(title = '', slideNumber = ''): SermonSlide {
  return {
    id: shortId(),
    show_number: false,
    slide_number: slideNumber,
    title,
    verse_reference: '',
    verse_text: '',
    body: '',
    image_url: '',
    is_full_image: false,
  };
}

export function getDefaultSermonRecord(title = 'New Sermon Notes'): SermonRecord {
  return {
    id: shortId(),
    title,
    speaker: '',
    date: new Date().toISOString().split('T')[0],
    main_verse: '',
    description: '',
    slides: [
      {
        id: shortId(),
        show_number: true,
        slide_number: '1',
        title: 'Present struggles are temporary',
        verse_reference: 'Romans 8:18',
        body: '* Real hope anchors through hardships\n* God works behind what we cannot see',
        image_url: '',
        is_full_image: false,
      },
    ],
    allow_personal_notes: true,
    service_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function sermonSlideToDefinition(slide: SermonSlide): SermonSlideDefinition {
  const isFull = Boolean(slide.is_full_image);
  return {
    id: slide.id || shortId(),
    name: slide.title || 'Sermon Slide',
    image: {
      enabled: Boolean(slide.image_url),
      url: slide.image_url || '',
      is_full_image: isFull,
    },
    text: {
      enabled: !isFull && Boolean(slide.title || slide.verse_reference || slide.body || slide.show_number),
      show_number: slide.show_number,
      slide_number: slide.slide_number,
      title: slide.title || '',
      verse_reference: slide.verse_reference || '',
      body: slide.body || '',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function sermonDefinitionToSlide(def: SermonSlideDefinition): SermonSlide {
  const isFull = Boolean(def.image.enabled && def.image.is_full_image);
  return {
    id: def.id,
    slide_id: def.id,
    show_number: !isFull && def.text.enabled ? def.text.show_number : false,
    slide_number: !isFull && def.text.enabled ? def.text.slide_number : undefined,
    title: !isFull && def.text.enabled ? def.text.title : '',
    verse_reference: !isFull && def.text.enabled ? def.text.verse_reference : '',
    body: !isFull && def.text.enabled ? def.text.body : '',
    image_url: def.image.enabled ? def.image.url : '',
    is_full_image: isFull,
  };
}
