import { slugify } from "./blog";

/**
 * A slug field that is required AND filled in for you.
 *
 * THE BUG THIS EXISTS FOR. Five collections declared `slug` as
 * `required: true` while a `beforeValidate` hook derived it from the title or
 * name, and the help text told staff to leave the box empty. Those cannot both
 * be true from the admin:
 *
 *   payload/dist/fields/validations.js  (text)
 *     if (required) { if (!value || value.length === 0) return t('validation:required') }
 *   @payloadcms/ui/dist/forms/Form/index.js:285
 *     if (!isValid_2) { errorToast(t('error:correctInvalidFields')); ... return }
 *
 * The client refuses to submit, so the request never reaches the server and the
 * hook that fills the slug never runs. Doing exactly what the description says
 * produced "Please correct invalid fields" and no saved document.
 *
 * SEVERITY DEPENDS ON DRAFTS, which is why it hid for so long. A collection with
 * `versions.drafts` has an escape hatch — SaveDraftButton submits with
 * `skipValidation: true` (@payloadcms/ui/dist/elements/SaveDraftButton/index.js:66),
 * so staff could Save draft, watch the slug appear, then Publish. Products,
 * Projects and Posts behave that way. Categories and Services have NO versions
 * key, so they render a plain Save button that validates — every save refused,
 * with no button to press instead. Categories is the one that hurt: the "+"
 * beside the Category picker on the product form opens it mid-flow.
 *
 * A custom `validate` REPLACES the built-in text validator rather than running
 * alongside it, so `required: true` stays declared — and the field stays
 * genuinely required, which matters because seed's cleanupMalformed() DELETES
 * rows with an empty slug on boot. The same function runs client-side and
 * server-side, so the two cannot disagree.
 */
export function slugFromTitleValidator(args: {
  /** The field the slug is derived from — "name" or "title". */
  source: string;
  /** What to call the thing in the error, e.g. "product", "department". */
  noun: string;
}) {
  return (value: unknown, ctx: unknown): true | string => {
    if (typeof value === "string" && value.trim() !== "") return true;
    const data = (ctx as { data?: Record<string, unknown> } | undefined)?.data;
    // slugify() returns "" for a title with no usable characters ("!!!"), and a
    // row saved with an empty slug is deleted by the boot seed — so that case
    // has to be refused here rather than allowed through to disappear later.
    if (slugify(String(data?.[args.source] ?? ""))) return true;
    return `Enter a web address, or give the ${args.noun} a name it can be made from.`;
  };
}
