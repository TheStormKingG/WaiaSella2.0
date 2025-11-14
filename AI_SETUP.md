# Manual Product Image Workflow

> **Status:** AI generation has been removed. Product images now rely entirely on photos that staff capture or upload during item entry.

---

## Why the Change?

- ✅ Users asked for a **simpler workflow** without AI dependencies.
- ✅ Mobile devices were running into **memory limits** while trying to generate images.
- ✅ Manual images give **full control** over branding and labels.

---

## Current Workflow

1. **Open the item modal** (Inventory → `+` or edit an existing item).
2. **Capture** a new photo or **upload** an existing one.
   - `Upload` button opens the device file picker.
   - `Camera` button is available on mobile devices that support capture.
3. **Enter details manually**:
   - Name
   - Category
   - Price & Cost
   - Stock & Low Point
4. **Save** to store everything locally and in Supabase (when configured).

The image preview updates instantly and is persisted exactly as provided—no AI post-processing is applied.

---

## Tips for Great Product Photos

- Use a clean surface with good lighting.
- Hold the camera steady; tap to focus on the label.
- Take landscape photos so the product fills most of the modal preview.
- Double-check that the label text is readable before saving.

---

## FAQ

**Q: Can we re-enable AI later?**  
Yes. The previous AI integration code has been archived in the repository history. Reintroducing it would require restoring `ai-config.ts`, the AI helper modules, and the related UI controls.

**Q: Do we still need API keys?**  
No. All AI configuration values are ignored now. You can remove AI-related environment variables and documentation if not needed.

**Q: How are images stored?**  
Images are stored as Base64 data URLs inside the inventory records, just like before. If Supabase is configured, the data is synced there as well.

---

## Housekeeping Checklist

- [x] Removed the “Generate AI Product Image” checkbox.
- [x] Removed the AI loading overlay.
- [x] Simplified `handleImageSelect` to only handle preview + storage.
- [x] Updated documentation to describe the manual process (this file).

---

Need help optimizing the manual photo flow? Reach out in the project issues and we can explore batch uploads, background removal, or other enhancements that keep control in the user’s hands.
- **Cost**: Monitor your API usage to control costs
- **Quality**: AI-generated images are 1024x1024px, optimized for product display

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify your API key and service configuration
3. Test with a simple item first (e.g., "Red Apple" in "Produce")
4. Review the API provider's documentation for specific service issues

## Why "Nano Banana"? 🍌

"Nano Banana" is the informal/nickname for **Google's Gemini 2.5 Flash Image model**. The community gave it this fun name, and it's become quite popular!

### Accessing Gemini Image Generation

You can access it through:
1. **Google AI Studio** (easiest - get free API key)
2. **Vertex AI** (enterprise Google Cloud integration)
3. **OpenAI-compatible endpoints** (via third-party wrappers)

This implementation uses the official Google Gemini API for the best performance and reliability.

## Service Comparison

| Service | Speed | Cost | Quality | Setup |
|---------|-------|------|---------|-------|
| **Gemini 2.5 Flash** 🍌 | ⚡⚡⚡ Very Fast | 💰 Very Cheap | ⭐⭐⭐⭐ Excellent | ✅ Easy |
| Stability AI | ⚡⚡ Fast | 💰💰 Moderate | ⭐⭐⭐⭐⭐ Top | ✅ Easy |
| Replicate | ⚡ Variable | 💰💰 Moderate | ⭐⭐⭐⭐ Good | ✅ Easy |
| DALL-E 3 | ⚡ Slower | 💰💰💰 Expensive | ⭐⭐⭐⭐⭐ Top | ✅ Easy |

**Recommendation**: Start with Gemini ("Nano Banana") for the best balance of speed, cost, and quality!

