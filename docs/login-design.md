# Login design implementation

Implemented from the screenshot supplied in this chat: 58/42 desktop split, dark emerald artwork, bright green accents, glass feature badges, white rounded form card, gradient button, language selector, remember-me option, password visibility, and contact/recovery guidance. On tablet and mobile, the form takes priority and the decorative hero is hidden. All visible copy supports English and Brazilian Portuguese.

Authentication uses the existing administrator credentials and server-side sessions. Remember me checked keeps the cookie for the existing 12-hour session; unchecked uses a browser-session cookie with the same server-side expiry. Google and Microsoft social login controls have been removed. Forgot password and contact controls direct the operator to their organization administrator; no fictitious account creation or password-reset email is sent.

## Artwork

Final asset: `public/images/login-hero.webp` (converted from the generated PNG to WebP for delivery). The supplied screenshot served as a visual reference. The background was recreated using the **built-in image_gen tool**, while all headings and floating labels are HTML and remain translatable. This is a close reconstruction, not a pixel-identical copy of the original artwork.

Final generation prompt:

> Use case: background-extraction / website asset. The supplied screenshot is a visual reference for an existing website login page. Create ONLY its LEFT dark green panel as a standalone square-ish 1:1 high-resolution background asset. Preserve the deep near-black emerald background, glowing translucent tilted 3D smartphone on the RIGHT SIDE, a bright white WhatsApp phone-in-chat logo centered on the phone screen, and thin sweeping neon-green flowing wave ribbons crossing lower half and rising behind the phone at upper right. Match the smartphone's placement: within left-panel coordinate system 970x940, phone occupies x600-880 and y220-680. IMPORTANT remove ALL webpage typography, ALL brand heading/logo at top-left, ALL floating green feature cards, ALL bottom benefit icons and labels, and ALL of the light right-hand login form. The upper left 55 percent must be clean dark green negative space for real HTML headings; bottom 20 percent similarly clean for real HTML benefit rows. No letters, no words, no fake UI, no floating labels. This is a BACKGROUND ART asset to be consumed behind actual web UI, not a screenshot of a whole website. Dark background not transparent.

## Official WhatsApp icon

The custom-drawn mark was replaced with the exact SVG path geometry served as the favicon on [WhatsApp’s official website](https://www.whatsapp.com/): https://static.whatsapp.net/rsrc.php/y1/r/FJbTMJqMap7.svg. The vector paths are included directly in `components/whatsapp-mark.tsx`; no separate SVG image file is needed. The same vector geometry is used in the header, form, recovery dialog, and over the phone illustration.
