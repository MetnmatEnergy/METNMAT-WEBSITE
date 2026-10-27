# METNMAT CMS handbook: changing www.metnmat.com

This is the knowledge file for the "Metnmat Website" Claude project. It was checked against the code on
2026-10-27. The source is `docs/claude-project/CMS-HANDBOOK.md` in the METNMAT-WEBSITE repo; when the CMS
changes, update it there and re-upload it to the project.

---

## 1. How it fits together

- **Admin:** https://admin.metnmat.com/admin (Payload CMS). **Website:** https://www.metnmat.com.
- The website reads everything below from the CMS. A change needs **no code, no GitHub and no deploy**.
- **When a change appears:** each save pings the website, so it usually shows within seconds. Every CMS read
  is also cached for at most 60 seconds, so it shows within about a minute even if the ping fails. If it
  still looks old, hard-refresh (Ctrl+Shift+R).
- **Saving a product or category also refreshes the chatbot's product catalogue.**

### Drafts: which saves are live immediately

| Item | Drafts? | Preview on the real site? | What Save does |
|---|---|---|---|
| **Products** | Yes | Yes (Preview button) | *Save Draft* is private; *Publish changes* is live |
| **Blog Articles** | Yes | Yes (Preview button) | Same, and a future publish date schedules it |
| **Projects** | Yes | **No**, the project page never shows drafts | *Save Draft* is private; *Publish changes* is live |
| **Everything else:** Categories, Services, FAQs, Team, Clients, Media, Documents, blog categories/types/authors, **every global** (Homepage, Navigation, Contact…) | **No** | No | **Save is live at once, with no history and no undo** |

For items without drafts, the "show first" step means filling in the form *without* saving, taking a
screenshot, and showing the before → after table. Save only after the person says yes. Write down the old
values before changing anything; a global has no version history to go back to.

---

## 2. Signing in and staff accounts

- The admin sign-in is a **4-digit PIN pad**. Each person uses their **own** PIN; never share one, never
  type someone else's.
- Error messages:
  - **"Invalid key."** appears for every failure. If the person is sure the PIN is right, the stored
    credential is out of step. A super-admin sets them a new PIN.
  - **"Too many attempts. Try again in 15 minutes."** The 6th try from one network in 15 minutes is refused,
    and the screen counts down. There is also a site-wide cap of 40 sign-in attempts per 15 minutes,
    successful sign-ins included.
- The "Recovery sign-in with email & password" link works only for accounts created **without** a PIN.
- **New staff account** (Administration → Users): only a **super-admin** can create a working PIN account.
  They set the name, email, a unique 4-digit PIN (shown once, never again) and a role. A forgotten PIN can't
  be looked up; set a new one.
- **Roles that can edit content:**
  - Products and Categories: super-admin, admin, operations manager, marketing, sales.
  - Pages, blog and media: super-admin, admin, marketing.
  - Globals (Homepage, Navigation, Contact…): super-admin, admin, marketing.
  - Custom *Staff Roles* can grant areas: Catalog, Website Content, Assets, Website Settings, and others.

Claude never touches Users or Staff Roles. Account changes are done by a super-admin.

---

## 3. Where do I change…?

| On the website | In the admin |
|---|---|
| A product's price, MRP, bulk prices | Catalog → **Products** → the product → **Pricing** tab |
| A product's photos or video | Products → the product → **Media** tab |
| A product's name, description, category | Products → **Essentials** tab |
| Specifications table, datasheets | Products → **Specs & documents** tab |
| In stock / made to order, Featured on homepage, badges | Products → **Storefront** tab (and *Tax, stock & fulfilment* → Product type) |
| GST rate, HSN code, stock quantity | Products → **Tax, stock & fulfilment** (collapsed section at the bottom) |
| Shop departments, the header department menu, `/shop/c/<slug>` | Catalog → **Categories** |
| Homepage hero headline, subtitle, buttons, stats, which sections show | Site & Mobile App → **Homepage** |
| Header menu links and footer link columns | Site & Mobile App → **Navigation** (the department menu comes from Categories) |
| Email and phone in the top bar and footer | Site & Mobile App → **Contact** (email, email 2, phone only) |
| Footer tagline and description, site name | Site & Mobile App → **Company** (legal name, tagline, description) |
| Social icons (LinkedIn, YouTube, Facebook, Amazon) | Marketing → **Social** |
| Site-wide default title and description for search engines | Marketing → **SEO** (keep `%s` in the title template) |
| A banner across the top of every page | Site & Mobile App → **Maintenance Notice** |
| `/services` and the homepage "What we do" block | Site & Mobile App → **Services** |
| `/projects`, the homepage case-study carousel | Site & Mobile App → **Projects** |
| Homepage FAQ | Site & Mobile App → **FAQs** |
| Team on `/about` | Site & Mobile App → **Team** |
| Homepage "Trusted by" logos | Site & Mobile App → **Clients & Partners** |
| Blog articles, `/blog` | Blog → **Blog Articles** |
| Privacy officer details on `/privacy` | Site & Mobile App → **Privacy & DPDP** |

**Not editable in the CMS (needs code, in Claude Code):**
- the `/contact` page, which is written into the code
- the site logo and favicon (the *Branding* global is **not used** by the website)
- the long text and photos on `/services` (the CMS only drives the summary)
- page layouts and design
- emails, checkout and payment behaviour.

---

## 4. Products, field by field

The product editor has tabs, plus a collapsed **Tax, stock & fulfilment** section at the bottom. The public
page is `https://www.metnmat.com/shop/p/<slug>`.

### Essentials
- **Name** (required): the customer-facing name, page title and search.
- **Brand**: use `METNMAT` for own-make items.
- **Slug** (the web address): fills itself in from the name. **Changing it changes the URL.** After the
  product has been published, the old URL redirects automatically. Change it only when asked.
- **SKU**: internal code, shown on the product page and invoices. Also used to match orders, so don't
  reuse one.
- **Category** (required): pick the *most specific* sub-category. The product still appears on the parent
  department's page.
- **Short description**: one sentence of about 120–160 characters. Used on product cards, in search results
  and as the search-engine description.
- **Description**: the full text on the product page.

### Media
- **Images**: the **first image is the thumbnail everywhere** (shop grid, homepage, search, cart). Later
  images form the product-page gallery. Drag rows to reorder.
- **YouTube video URL**: optional; must be a youtu.be or youtube.com link. It plays in the gallery.

### Pricing (section 5 has the rules)
- **International pricing:** *Automatic ₹ → $ conversion* or *Fixed international $ price*.
- **Price**: ₹, excluding GST, per unit.
- **USD price ($)**: shown only in Fixed mode, and required there.
- **Unit**: for example "unit", "piece", "sheet".
- **MRP**: the struck-through list price.
- **MOQ**: minimum order quantity.
- **Lead time**: for example "Ships in 1–2 weeks".
- **Bulk price tiers**: minimum quantity and the price at that quantity.

### Specs & documents
- **Available sizes**: a size picker on the product page.
- **Specifications**: label/value pairs. The first 6 show as "Key specifications" beside the gallery; the
  rest go in the Specifications tab.
- **Documents**: datasheets, SDS and certificates. Upload them under Documents first, then link them here.

### Storefront
- **In stock**: the flag behind the website's In-stock / Made-to-order label. It is separate from the stock
  quantity.
- **Featured**: shows the product in the homepage hero showcase, the homepage preview row and "Featured
  products" on /shop. Keep about 8 products featured.
- **Rating**: **leave empty** unless there is real, verifiable customer feedback. Any value above 0 shows
  public stars, and invented ratings are misleading advertising.
- **Badges**: Bestseller, New, GST invoice, Made by METNMAT. Only ones that are true.

### SEO (all optional)
- SEO title, meta description and keywords.
- **Canonical URL**: leave blank unless the product truly lives on another URL.
- OG image: the social sharing image; defaults to the first photo.
- **No-index**: hides the product from search engines. It stays reachable on the site.

### Tax, stock & fulfilment (collapsed, at the bottom)
- **GST rate**: a GST slab. **This changes what customers pay** (section 5).
- **HSN / SAC code**, **Country of origin**.
- **Product type**:
  - *In stock* and *Made to order* are buyable, **but only if Price is above 0**.
  - *Quote only* and *Discontinued* are enquiry-only: no price, no buy button.
- **Stock quantity**: can be typed only on the product's **first** save. After that it is locked; it moves
  only through the **Adjust stock** panel, which records who changed it and why.
- **Reserved stock**: moved by orders only.
- **Low-stock threshold**.
- **Package weight (kg)**.
- **Price approval status**: tracking only. It does *not* stop a product being sold; use Draft for that.
- **Last reviewed**.

### Preview and publish a product
1. Make the edit and click **Save Draft**.
2. Click **Preview**. The real product page opens in preview mode (see section 11).
3. After approval, click **Publish changes**.
4. Open `/api/preview/exit` and check the public page.

A product that is published and then edited stays live in its old form until **Publish changes** is clicked.

### Taking a product off sale
Never delete it. Choose the option that fits:
- Untick **In stock**: it shows as made to order.
- Set Product type to **Quote only**: it becomes enquiry-only.
- Set Product type to **Discontinued**.
- Unpublish it.

Deleting is refused while orders or stock records point at the product, and a delete throws away its photo
links.

---

## 5. Prices: the rules

- **The CMS stores prices without GST; the website shows them with GST**, rounded to the rupee.
  Website price = round(CMS price × (1 + GST rate ÷ 100)).

  | CMS price | GST | Shown on the website |
  |---|---|---|
  | 10,000 | 18% | ₹11,800 |
  | 4,237.29 | 18% | ₹5,000 |
  | 10,000 | 5% | ₹10,500 |

- **Given a website price**, CMS price = website price ÷ (1 + rate ÷ 100), kept to 2 decimals. Check the
  result rounds back to the figure you were given. **If you can't tell whether a figure includes GST, ask.**
- **Price 0 or empty = "Price on request"**: no Add to cart, an enquiry button instead, whatever the product
  type says.
- **MRP above Price** shows a struck-through MRP and an "% off" label. MRP at or below Price shows no
  discount.
- **Bulk price tiers:** every tier price must be **below** the base price, and no two tiers may share a
  minimum quantity. Otherwise the save is refused with an inline message. Tiers also display with GST.
- **GST rate** must be a real slab. Changing it changes the customer's price: ₹100 is ₹118 at 18% and ₹105
  at 5%. Orders already placed keep their invoiced rate. Change it only when explicitly asked, and say so in
  the preview.
- **International:**
  - In *Automatic* mode the $ price follows the ₹ price at the live exchange rate.
  - In *Fixed* mode the **USD price is the final, tax-inclusive** price international customers pay. It
    must be above 0.
  - The **Commerce & Pricing** global's USD rate is only a last-resort fallback, so editing it usually
    changes nothing visible.
- **Commerce & Pricing global:** its tax settings change what checkout charges. **Don't touch them.** The
  owner and the CA decide those.

---

## 6. Photos and the Media library

- **File types:** JPG, PNG, WebP, AVIF. **No SVG.** **Maximum 25 MB.**
- **Every upload needs Alt text** (describe the item, e.g. "Titanium felt electrode, 100 × 100 mm") and a
  **Category**.
- **Product photos:** choose the **Product Image** category. It requires the **shortest side to be at least
  900 px**; smaller files are refused with the measured size. Best is 2400 × 1800 (4:3), a clean, well-lit
  shot on a plain background.
- **Other images:** use Hero Banner, Logo, Catalog Image and so on. These have no size floor.
- **How photos display:** every product photo shows whole (never cropped) in a fixed **4:3 frame**. So:
  - a **portrait (tall) photo looks small**, with empty space at the sides
  - landscape or square photos fill the frame best
  - mention this in the preview when it applies.
- **Focal point:** dragging it recomposes the product display crop.
- **Sizes are made at upload time** (micro, thumb, card, pdp, zoom, display, all WebP). To change how a
  photo looks, upload a better file rather than expecting old images to be regenerated.
- **Replacing a photo already used elsewhere:** tick **Replace it everywhere**. The CMS refuses once and
  names the pages affected, so check that list before confirming.
- **Deleting media is refused** while a product, category, project, post, service, team member, client,
  author or global uses it. Images pasted *inside* rich-text descriptions are **not** protected, so check
  before deleting anything.
- **Bulk uploads:** a few files at a time. A big burst can exhaust the CMS's memory and restart it.
- **To add a photo to a product:**
  1. Product → Media tab → *Add Image*.
  2. Upload, or pick an existing file.
  3. Set Alt text and Category = Product Image.
  4. Order the rows; the first one is the thumbnail.
  5. **Save Draft** → Preview.

---

## 7. Categories (shop departments)

- **No drafts: Save is live.**
- Fields:
  - **Name**.
  - **Slug**: changing it redirects the old `/shop/c/<old>` automatically.
  - **Blurb**.
  - **Parent**: empty means a top-level department.
  - **Image**.
  - **Order**: lowest first, within its parent.
  - **Hide from the storefront**: removes the category everywhere. Its products stay buyable.
- Where it shows: the `/shop` department grid, the header department menu, `/shop/c/<slug>`, filters,
  search and breadcrumbs.
- **Retire a department with "Hide from the storefront"**, never delete. Deleting is refused while products
  or sub-categories use it. A deleted or renamed *original* department is **re-created on the next CMS
  restart** (section 12).
- Replace a category image rather than clearing it: clearing brings the default banner back on restart.

---

## 8. Homepage, menus, footer and other globals

**Every global goes live on Save, with no history and no undo.** Write down the old values before you
change one.

- **Homepage:**
  - Fields: Hero eyebrow, Title lead, Title accent (in the brand gradient), Subtitle, primary and secondary
    button label and link, Stats (value + label; also shown on `/about`), Featured project, and toggles for
    the Clients / Services / Projects / Blog sections.
  - ⚠ **Never clear "Title lead".** On the next restart the whole hero, stats and toggles are reset to
    defaults.
  - Featured project can't be left empty (it refills on restart). Choose a published, active project.
- **Navigation:**
  - Header links (label + link) and footer columns (title + links).
  - Links aren't checked, so a typo means a broken link. Use site paths like `/shop` or full `https://`
    links.
  - ⚠ **Never remove every header link.** Header *and* footer fall back to the built-in menus, and the
    defaults return on restart.
- **Contact:**
  - Email, email 2 and phone show in the top bar and footer.
  - WhatsApp, shipping note and addresses are **not shown** anywhere.
  - The `/contact` page does **not** use this global; it needs code.
- **Company:**
  - Legal name shows in the footer and as the site name. Tagline and description show in the footer.
  - Name, about and founded year are not shown.
- **Social:**
  - LinkedIn, YouTube, Facebook and Amazon show in the top bar and footer.
  - Clearing one doesn't remove the icon; it falls back to a built-in link. Instagram and X aren't shown.
- **SEO:**
  - Default title, title template and description apply site-wide. **Keep `%s` in the template**; it sets
    every page's title.
  - Keywords and OG image are not used.
- **Maintenance Notice:**
  - "Show maintenance banner", message, "show contact line". The banner appears on every page.
  - A message mentioning "metnmat.in" is switched off on restart.
- **Privacy & DPDP:**
  - Officer name, email, phone and response days, shown on `/privacy`.
  - The email must be a mailbox someone actually reads.
- **Branding:** **not used by the website.** Changing the logo here changes nothing.
- **Commerce & Pricing:** **don't touch** (section 5).

---

## 9. Blog articles

- Drafts and Preview work like products. The public page is `/blog/<slug>`.
- **Live** means published, *not archived*, and with a publish date that is not in the future.
- **Publish date:**
  - A future date plus Publish **schedules** the article. It appears within about a minute of that time.
  - Publishing without a date stamps "now".
- **Workflow status** (draft / in review / approved) is only a label. **Publish** is what makes the article
  live.
- **Required to publish:** Title, Excerpt (cards, search and the default description), plus the usual slug.
  Save Draft skips the checks.
- **Other fields:**
  - Cover image, Cover alt, Cover caption.
  - Attachments: Documents, which must be ticked **Public** or they are left off.
  - Classification: content type, category, keywords, tags.
  - Authors, DOI, references.
  - SEO: Canonical URL and No-index. Both affect search engines, so leave them unless asked.
- **Featured** and **Editor's pick** put the article in the featured rail. **Archived** hides it but keeps
  it published.
- **Changing a published article's slug** redirects the old URL automatically.
- **The weekly article pipeline** updates an article that has the same slug, which overwrites staff edits.
  To stop a scheduled pipeline article, **Unpublish** it.
- **Publication Requests** (from the `/blog/submit` form): setting Status to *Revision requested*,
  *Approved* or *Rejected* **immediately emails the contributor**. Write the decision message first, and
  only change a status when the team asks. **Convert** creates a new draft article and never publishes.

---

## 10. Projects, Services, FAQs, Team, Clients, Documents

- **Projects:**
  - Drafts, but **no Preview**: show a screenshot of the edit form instead.
  - **Live** means published *and* Active.
  - Fields: Title, Slug, Subtitle, **Category** (spelling must match other projects exactly; it drives the
    filter), Client, Summary, Body, Highlights, Tags, Cover image + alt, Gallery, SEO, Year, Order, Featured
    (the `/projects` spotlight), Active.
  - ⚠ **A slug change has no redirect**, so the old URL 404s.
  - ⚠ **External URL** becomes the page's canonical, which tells search engines the page lives elsewhere.
    Leave it blank unless asked.
- **Services:**
  - No drafts.
  - The homepage shows the **first 6 active** services by Order. Only Title, Summary, Icon and Active are
    used on the site; Description, Image and Featured are not.
  - The longer text and photo on `/services` come from code matched by slug, so **don't change a slug**;
    a new service shows only its summary.
  - Untick **Active** rather than deleting.
- **FAQs:**
  - No drafts. Question, Answer, Order and Active, shown in the homepage FAQ.
  - With no active FAQs, built-in defaults appear.
- **Team:**
  - No drafts. Name, Role, Photo, Bio, Order and Active, shown on `/about`. LinkedIn is not shown.
- **Clients & Partners:**
  - No drafts. Name, **Logo** (required), Type (company or institution decides the row), Order and Active.
  - URL is not used.
  - Shown on the homepage when Homepage → Clients is on.
- **Documents:**
  - PDF only. Private unless **Public** is ticked.
  - This collection also holds **quotations and invoices with customer data**. Never tick Public on those,
    and never delete documents.

---

## 11. Preview mode on the real site

- **Preview** (Products and Blog Articles only) opens a signed link, valid for 1 hour, which switches **that
  browser** into preview mode and shows the latest **saved draft**.
- **The banner says which case you're in:**
  - **Coloured banner, "Draft preview — this version is not public yet":** nothing is published yet.
  - **Neutral banner, "Preview mode. This page is published and live…":** a published version exists. The
    page body you see is still the **draft**, so customers see the old published version until **Publish
    changes**.
- **Exit** with the banner's "Exit preview" link or https://www.metnmat.com/api/preview/exit. Until you do,
  every product and article you open in that browser shows drafts.
- **Never forward a preview link.** It gives the recipient's browser draft access to the whole catalogue.
  Share a screenshot instead.
- "Preview link is invalid or has expired." means you should click Preview in the CMS again.

---

## 12. Things the CMS silently undoes on restart

The CMS restarts on deploys, memory spikes and settings reloads, and on every start it re-creates its
original content where it is missing. These changes **don't stick**:

| If you… | On the next restart… |
|---|---|
| Delete an original shop department or change its slug | It is re-created with the original slug. Use **Hide from the storefront** instead |
| Clear an original department's image | The default banner comes back. Replace the image instead |
| Delete an original service, or empty Services | Re-created. Untick **Active** instead |
| Delete every FAQ, blog category or content type | The defaults come back. Untick **Active** instead |
| Delete the `co2-fuel-cells` article or change its slug | Re-created and published |
| Clear the cover on an original article or project | The cover comes back |
| Clear Homepage → Title lead | The whole hero, stats and toggles are reset |
| Clear Homepage → Featured project | It is refilled |
| Remove every header link | The default navigation is restored |
| Clear all the main fields of Company, Contact, Social or SEO | That global is reset to defaults |

Existing products are never changed by a restart; staff edits to products always stick.

---

## 13. Edits that change nothing on the site (tell the person rather than "doing" them)

- **Branding:** the whole global.
- **Company:** name, about, founded year.
- **Contact:** WhatsApp, shipping note, addresses (and the `/contact` page ignores this global).
- **Social:** Instagram, X.
- **SEO:** keywords, OG image.
- **Services:** Featured, Description, Image.
- **FAQs:** Category.
- **Clients:** URL.
- **Team:** LinkedIn.
- **Commerce:** the USD rate (usually), and the auto-cancel settings.

---

## 14. Leave alone

- **Sales:** Orders, Invoices, Payment Events, Shipments, Quotations, Enquiries, Returns.
  - Several of these **email customers** or move stock when their status changes.
  - **A reply in a Support Ticket conversation is emailed to the customer.**
- **People data:** Customers, Leads, Data Requests (DPDP). All personal data.
- **Administration:** Users, Staff Roles, Audit Logs.
- **System group:** Integration Logs, Counters, Analytics. **Catalog:** Stock Ledger, and the slug-redirect
  tables (deleting a redirect breaks an old URL).
- **Anything containing the word "delete"**, unless the owner explicitly asked for that delete.

---

## 15. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Change not showing after a minute | Was it **published** (not just a saved draft)? Then hard-refresh. Is the browser still in preview mode? Exit preview |
| Product shows "Price on request" | Price is 0 or empty, or Product type is Quote only / Discontinued |
| Product has no Add to cart | Same as above |
| Product photo looks tiny | Portrait photo in the 4:3 frame. Use a landscape or square photo |
| Upload refused: "shortest side…" | Product Image needs at least 900 px on the short side |
| Upload refused: "…has not been saved" | File over 25 MB |
| Save refused on bulk tiers | A tier price isn't below the base price, or two tiers share a quantity |
| Save refused on USD price | Fixed mode needs a USD price above 0; Automatic mode needs it empty |
| Delete refused | Something still uses it. This is intended: hide, unpublish or discontinue instead |
| Old product URL still works after a slug change | Expected: it redirects to the new URL |
| "Invalid key." at sign-in | Wrong PIN, or a stale credential. A super-admin sets a new PIN |
| "Too many attempts" | Wait 15 minutes; the screen counts down |
| A change I made came back | Section 12: a restart re-created original content |
