import type {
  AnnouncementSlide,
  AppDeeplink,
  SlideDefinition,
} from './types';
import { shortId } from './utils';

export function getDefaultSlideDefinition(name = 'New Slide'): SlideDefinition {
  return {
    id: shortId(),
    name,
    image: {
      enabled: false,
      url: '',
      is_full_image: false,
    },
    text: {
      enabled: true,
      title: '',
      subtitle: '',
      body: '',
    },
    cta: {
      enabled: false,
      style: 'button',
      icon: 'external-link',
      label: 'Learn More',
      action_type: 'url',
      target_url: '',
      deeplink_id: '',
      mailto_email: '',
      mailto_subject: '',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function slideDefinitionToAnnouncementSlide(
  slide: SlideDefinition,
  deeplinks?: AppDeeplink[],
): AnnouncementSlide {
  const isFullImage = Boolean(slide.image?.enabled && slide.image?.is_full_image);
  const deeplink = slide.cta?.deeplink_id
    ? (deeplinks || []).find((d) => d.id === slide.cta.deeplink_id)
    : undefined;

  let ctaUrl = '';
  if (slide.cta?.enabled) {
    if (slide.cta.action_type === 'url' || slide.cta.action_type === 'pco') {
      ctaUrl = slide.cta.target_url || '';
    } else if (slide.cta.action_type === 'mailto') {
      const email = (slide.cta.mailto_email || '').trim();
      const subject = (slide.cta.mailto_subject || '').trim();
      ctaUrl = email ? `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}` : '';
    } else if (slide.cta.action_type === 'deeplink' && deeplink) {
      ctaUrl = deeplink.ios_url || deeplink.android_url || '';
    }
  }

  return {
    id: slide.id,
    slide_id: slide.id,
    title: (!isFullImage && slide.text?.enabled) ? slide.text.title : '',
    subtitle: (!isFullImage && slide.text?.enabled) ? slide.text.subtitle : '',
    body: (!isFullImage && slide.text?.enabled) ? slide.text.body : '',
    image_url: slide.image?.enabled ? slide.image.url : '',
    is_full_image: isFullImage,
    cta_label: slide.cta?.enabled ? slide.cta.label : '',
    cta_url: ctaUrl,
    cta_style: slide.cta?.enabled ? slide.cta.style : undefined,
    cta_icon: slide.cta?.enabled ? slide.cta.icon : undefined,
    cta_action_type: slide.cta?.enabled ? slide.cta.action_type : undefined,
    deeplink_id: slide.cta?.enabled && slide.cta.action_type === 'deeplink' ? slide.cta.deeplink_id : undefined,
    deeplink_ios_url: deeplink?.ios_url,
    deeplink_android_url: deeplink?.android_url,
  };
}

export function announcementSlideToSlideDefinition(slide: AnnouncementSlide): SlideDefinition {
  const isFull = Boolean(slide.is_full_image);
  return {
    id: slide.id || shortId(),
    name: slide.title || 'Untitled Slide',
    image: {
      enabled: Boolean(slide.image_url),
      url: slide.image_url || '',
      is_full_image: isFull,
    },
    text: {
      enabled: !isFull && Boolean(slide.title || slide.subtitle || slide.body),
      title: slide.title || '',
      subtitle: slide.subtitle || '',
      body: slide.body || '',
    },
    cta: {
      enabled: Boolean(slide.cta_url || slide.cta_label),
      style: slide.cta_style || 'button',
      icon: slide.cta_icon || 'external-link',
      label: slide.cta_label || 'Learn More',
      action_type: slide.cta_action_type || (slide.deeplink_id ? 'deeplink' : 'url'),
      target_url: slide.cta_url || '',
      deeplink_id: slide.deeplink_id || '',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function resolveSlideDeeplinkUrl(
  slide: AnnouncementSlide,
  deeplinks?: AppDeeplink[],
  isIos = false,
  isAndroid = false,
): string | undefined {
  if (slide.cta_action_type !== 'deeplink') return slide.cta_url;

  // Check slide snapshot first
  const iosUrl = slide.deeplink_ios_url;
  const androidUrl = slide.deeplink_android_url;

  // Fallback to searching church deeplinks if not in snapshot
  let resolvedIos = iosUrl;
  let resolvedAndroid = androidUrl;
  if (!resolvedIos && !resolvedAndroid && slide.deeplink_id && deeplinks) {
    const match = deeplinks.find((d) => d.id === slide.deeplink_id);
    if (match) {
      resolvedIos = match.ios_url;
      resolvedAndroid = match.android_url;
    }
  }

  if (isIos && resolvedIos) return resolvedIos;
  if (isAndroid && resolvedAndroid) return resolvedAndroid;
  return resolvedIos || resolvedAndroid || slide.cta_url;
}
