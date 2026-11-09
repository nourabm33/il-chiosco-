# Il Chiosco · Coffee batch 01

Five representative 3D servings for the Alba menu. The dimensions below are estimated from the supplied views and expressed as width × height × depth. All five Blender files contain editable meter-scale geometry, packed textures and a studio scene. The GLB and USDZ exports share the same floor contact and bottom-centered origin.

| Menu product and source collage | Editable source | Website and AR exports | Dimensions (mm) | Studio review |
| --- | --- | --- | --- | --- |
| Americano · `americano.webp` | [Blender](../../tools/models/coffee-batch-01/sources/alba-americano.blend) | [GLB](../../assets/models/realistic/alba-americano.glb) · [USDZ](../../assets/models/realistic/alba-americano.usdz) | 154 × 63 × 154 | [Four views](americano-four-views.webp) |
| Cappuccino · `cappuchino.webp` | [Blender](../../tools/models/coffee-batch-01/sources/alba-cappuccino.blend) | [GLB](../../assets/models/realistic/alba-cappuccino.glb) · [USDZ](../../assets/models/realistic/alba-cappuccino.usdz) | 146 × 56 × 146 | [Four views](cappuccino-four-views.webp) |
| Espresso · `espresso.jpeg` | [Blender](../../tools/models/coffee-batch-01/sources/alba-espresso.blend) | [GLB](../../assets/models/realistic/alba-espresso.glb) · [USDZ](../../assets/models/realistic/alba-espresso.usdz) | 114 × 55 × 114 | [Four views](espresso-four-views.webp) |
| Flat White · `Flat White.webp` | [Blender](../../tools/models/coffee-batch-01/sources/alba-flat-white.blend) | [GLB](../../assets/models/realistic/alba-flat-white.glb) · [USDZ](../../assets/models/realistic/alba-flat-white.usdz) | 98.5 × 81.5 × 77.6 | [Four views](flat-white-four-views.webp) |
| Latte macchiato · `latte macchiato.webp` | [Blender](../../tools/models/coffee-batch-01/sources/alba-latte-macchiato.blend) | [GLB](../../assets/models/realistic/alba-latte-macchiato.glb) · [USDZ](../../assets/models/realistic/alba-latte-macchiato.usdz) | 116.9 × 127.3 × 91 | [Four views](latte-macchiato-four-views.webp) |

## Reference decisions

### Americano

The upper-right and lower-left views guided the slightly tapered ivory cup, matching saucer, rounded handle and steel teaspoon. Dark coffee sits below the lip with a narrow meniscus and an uneven bubble ring. The tabletop props and loose coffee beans served as lighting and scale references.

### Cappuccino

The lower-left serving guided the rounded ceramic cup, handle, saucer and teaspoon. The overhead panel supplied the isolated heart pour. Its crema fades into an authored edge ring with micro-bubble normal detail. The foam rises slightly toward the center.

### Espresso

The lower-left and lower-right views guided the small cool-white demitasse with a compact handle and recessed saucer. The liquid surface sits 13.5 mm below the lip. The amber crema, dark crescent and fine bubbles were authored to avoid carrying the hard cast shadow from the reference into the rotating material.

### Flat White

The lower-right fluted glass guided the straight sidewall, thick base and squared clear handle. The isolated tulip pour comes from the overhead panel. The side gradient and narrow foam band model the photographed serving. The smooth glass in the lower-left view depicts a separate presentation.

### Latte macchiato

The lower-left stemless glass guided the flared profile, tall curved handle and heavy clear base. The model uses that vessel consistently. The upper-left pour supplies the foam design and the lower-right side view guides the progression from light milk to coffee and foam. The upper-right panel shows a footed glass.

## Limits and reproduction

The models use hand-built silhouettes and PBR surfaces. Three coffee tops use isolated foam details projected from the supplied overhead panels. The vessel dimensions are estimates. The GLB and USDZ use opacity-based glass for broader mobile rendering compatibility, while the Blender studio renders use transmission and refraction. The optical appearance in a native phone viewer may differ.

The four source panels per drink and checksums are in the local reference workspace at `work/coffee-batch/references`. The originals stay in the supplied Desktop folder. The [texture script](../../tools/models/coffee-batch-01/textures.py) takes that folder and a writable workspace as arguments. Run the [Blender build script](../../tools/models/coffee-batch-01/build.py) once per product with the texture workspace, a render output directory and the product identifier from the table’s links. Pass `--render` to export all four studio views. The saved Blender files also open independently with their texture maps packed.

## Menu review

- [Desktop viewer](desktop-viewer.webp)
- [Viewer at 320 px](viewer-320.webp)
- [Before and after for all five products](before-after.webp)

The baseline is `19788d2`, after PR #18. Espresso and Cappuccino replace the baseline 3D models. The other three move from photo-only previews in that baseline to 3D. Each card has a studio thumbnail, and the photo tab uses its existing menu photo.

## Verification

- Reopened all five `.blend` files with Blender 4.5 LTS and checked their packed images.
- Validated the 112-product media manifest and all 13 ready GLB and USDZ pairs. The five new GLBs are 1.66–2.30 MB and use 26,436–49,508 triangles. OpenUSD checked package alignment, textures and meter-scale bounds.
- Loaded each drink in Chromium at 1360, 390 and 320 px. Exercised mouse drag and wheel zoom, emulated touch drag and pinch, reset, photo/3D, adjacent products, close and focus restoration. Forced a GLB load failure to check the English loading and photo fallback states.
- Intercepted the ten handoffs from model-viewer under iPhone and Android browser emulation. Quick Look received the selected USDZ with fixed scaling. Scene Viewer received the selected GLB with fixed scaling and horizontal placement configured.
- A separate catalog smoke test loaded all 13 ready GLBs and checked the images and menu entries for all 112 products. Its favicon 404 also reproduced on the baseline.
- Live phone camera tracking, anchoring, table placement and native glass appearance remain unverified.
