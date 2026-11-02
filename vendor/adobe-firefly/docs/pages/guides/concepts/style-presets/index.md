---
title: Style Presets - Adobe Firefly APIs
description: A guide to using style presets with the Firefly Image Model APIs.
keywords:
  - Styles
  - Adobe Firefly Services
  - Firefly API
  - Developer documentation
  - generateImages
  - Style concepts
  - UI styling
  - CSS
  - Design system
  - Styling guidelines
  - Theme customization
  - User interface design
  - Responsive design
  - Custom styles
  - Style overrides
  - Design tokens
  - CSS variables
contributors:
  - 'https://github.com/bishoysefin'
  - 'https://github.com/amandahuarng'
  - 'https://github.com/nimithajalal'
  - 'https://github.com/hollyschinsky'
hideBreadcrumbNav: true
og:
  title: Style Presets - Adobe Firefly APIs
  description: A guide to using style presets with the Firefly Image Model APIs.
twitter:
  card: summary
  title: Style Presets - Adobe Firefly APIs
  description: A guide to using style presets with the Firefly Image Model APIs.
---

# Style Presets

Use style presets to customize the look and feel of your generated images.

## Understanding style presets

Firefly offers a collection of style presets to use with the [Generate Images API][1] that can give generated images a specific visual style or mood. By indicating these presets in the API request, you have more control, beyond the prompt, to create image variations.

Style presets are defined in the `presets` array in the Generate Images API request. All presets in the array apply to the generated image. To influence the impact of the presets, add or adjust the `strength` value.

<CodeBlock slots="heading, code" languages="JSON" />

Request parameter for presets

```json
// ... API request cURL ...
--data '{
    "prompt": "a puppy dressed as a renaissance artist",
    "numVariations": 4,
    "style": {
        // array of style presets for image variations
        "presets": [   
            "bw", "fantasy", "dramatic_light"
        ],
        "strength": 100
    }
}'
```

## Style Presets examples

Here are the style presets available and examples of the images they generate. Use these presets, in snake_case, in the API request.

||||
| --- | --- | --- |
| ![Graphic](../../images/styles/2x/graphic.png) graphic | ![Wireframe](../../images/styles/2x/wireframe.png) wireframe | ![Vector look](../../images/styles/2x/vector-look.png) vector_look
| ![Black and white](../../images/styles/2x/black-and-white.png) bw | ![Cool tone](../../images/styles/2x/cool-tone.png) cool_colors | ![Golden](../../images/styles/2x/golden.png) golden
| ![Monochromatic](../../images/styles/2x/monochromatic.png) monochromatic | ![Muted color](../../images/styles/2x/muted-color.png) muted_color | ![Pastel color](../../images/styles/2x/pastel-color.png) pastel_color
| ![Toned image](../../images/styles/2x/toned-image.png) toned_image | ![Vibrant colors](../../images/styles/2x/vibrant-colors.png) vibrant_colors | ![Warm tone](../../images/styles/2x/warm-tone.png) warm_tone
| ![Closeup](../../images/styles/2x/closeup.png) closeup | ![Knolling](../../images/styles/2x/knolling.png) knolling | ![Landscape photography](../../images/styles/2x/landscape-photography.png) landscape_photography
| ![Macrophotography](../../images/styles/2x/macrophotography.png) macrophotography | ![Photographed through window](../../images/styles/2x/photographed-through-window.png) photographed_through_window | ![Shallow depth of field](../../images/styles/2x/shallow-depth-of-field.png) shallow_depth_of_field
| ![Shot from above](../../images/styles/2x/shot-from-above.png) shot_from_above | ![Shot from below](../../images/styles/2x/shot-from-below.png) shot_from_below | ![Surface detail](../../images/styles/2x/surface-detail.png) surface_detail
| ![Wide angle](../../images/styles/2x/wide-angle.png) wide_angle | ![Beautiful](../../images/styles/2x/beautiful.png) beautiful | ![Bohemian](../../images/styles/2x/bohemian.png) bohemian
| ![Chaotic](../../images/styles/2x/chaotic.png) chaotic | ![Dais](../../images/styles/2x/dais.png) dais | ![Divine](../../images/styles/2x/divine.png) divine
| ![Eclectic](../../images/styles/2x/eclectic.png) eclectic | ![Futuristic](../../images/styles/2x/futuristic.png) futuristic | ![Kitschy](../../images/styles/2x/kitschy.png) kitschy
| ![Nostalgic](../../images/styles/2x/nostalgic.png) nostalgic | ![Simple](../../images/styles/2x/simple.png) simple | ![Antique photo](../../images/styles/2x/antique-photo.png) antique_photo
| ![Bioluminescent](../../images/styles/2x/bioluminescent.png) bioluminescent | ![Bokeh effect](../../images/styles/2x/bokeh-effect.png) bokeh | ![Color explosion](../../images/styles/2x/color-explosion.png) color_explosion
| ![Dark](../../images/styles/2x/dark.png) dark | ![Faded image](../../images/styles/2x/faded-image.png) faded_image | ![Fisheye](../../images/styles/2x/fisheye.png) fisheye
| ![Gomori photography](../../images/styles/2x/gomori-photography.png) gomori_photography | ![Grainy film](../../images/styles/2x/grainy-film.png) grainy_film | ![Iridescent](../../images/styles/2x/iridescent.png) iridescent
| ![Isometric](../../images/styles/2x/isometric.png) isometric | ![Misty](../../images/styles/2x/misty.png) misty | ![Neon](../../images/styles/2x/neon.png) neon
| ![Otherworldly depiction](../../images/styles/2x/otherworldly-depiction.png) otherworldly_depiction | ![Ultraviolet](../../images/styles/2x/ultraviolet.png) ultraviolet | ![Underwater](../../images/styles/2x/underwater.png) underwater
| ![Backlighting](../../images/styles/2x/backlighting.png) backlighting | ![Dramatic light](../../images/styles/2x/dramatic-lighting.png) dramatic_light | ![Golden hour](../../images/styles/2x/golden-hour.png) golden_hour
| ![Harsh light](../../images/styles/2x/harsh-light.png) harsh_light | ![Long-time exposure](../../images/styles/2x/long-time-exposure.png) long | ![Low lighting](../../images/styles/2x/low-lighting.png) low_lighting
| ![Multiexposure](../../images/styles/2x/multiexposure.png) multiexposure | ![Studio light](../../images/styles/2x/studio-light.png) studio_light | ![Surreal lighting](../../images/styles/2x/surreal-lighting.png) surreal_lighting
| ![3d patterns](../../images/styles/2x/3d-patterns.png) 3d_patterns | ![Charcoal](../../images/styles/2x/charcoal.png) charcoal | ![Claymation](../../images/styles/2x/claymation.png) claymation
| ![Fabric](../../images/styles/2x/fabric.png) fabric | ![Fur](../../images/styles/2x/fur.png) fur | ![Guilloche patterns](../../images/styles/2x/guilloche-patterns.png) guilloche_patterns
| ![Layered paper](../../images/styles/2x/layered-paper.png) layered_paper | ![Marble](../../images/styles/2x/marble.png) marble_sculpture | ![Metal](../../images/styles/2x/metal.png) made_of_metal
| ![Origami](../../images/styles/2x/origami.png) origami | ![Paper mache](../../images/styles/2x/paper-mache.png) paper_mache | ![Polka-dot pattern](../../images/styles/2x/polka-dot-pattern.png) polka
| ![Strange patterns](../../images/styles/2x/strange-patterns.png) strange_patterns | ![Wood carving](../../images/styles/2x/wood-carving.png) wood_carving | ![Yarn](../../images/styles/2x/yarn.png) yarn
| ![Art deco](../../images/styles/2x/art-deco.png) art_deco | ![Art nouveau](../../images/styles/2x/art-nouveau.png) art_nouveau | ![Baroque](../../images/styles/2x/baroque.png) baroque
| ![Bauhaus](../../images/styles/2x/bauhaus.png) bauhaus | ![Constructivism](../../images/styles/2x/constructivism.png) constructivism | ![Cubism](../../images/styles/2x/cubism.png) cubism
| ![Cyberpunk](../../images/styles/2x/cyberpunk.png) cyberpunk | ![Fantasy](../../images/styles/2x/fantasy.png) fantasy | ![Fauvism](../../images/styles/2x/fauvism.png) fauvism
| ![Film noir](../../images/styles/2x/film-noir.png) film_noir | ![Glitch art](../../images/styles/2x/glitch-art.png) glitch_art | ![Impressionism](../../images/styles/2x/impressionism.png) impressionism
| ![Industrial](../../images/styles/2x/industrial.png) industrialism | ![Maximalism](../../images/styles/2x/maximalism.png) maximalism | ![Minimalism](../../images/styles/2x/minimalism.png) minimalism
| ![Modern art](../../images/styles/2x/modern-art.png) modern_art | ![Modernism](../../images/styles/2x/modernism.png) modernism | ![Neo-expressionism](../../images/styles/2x/neoexpressionism.png) neo
| ![Pointillism](../../images/styles/2x/pointillism.png) pointillism | ![Psychedelic](../../images/styles/2x/psychedelic.png) psychedelic | ![Science fiction](../../images/styles/2x/science-fiction.png) science_fiction
| ![Steampunk](../../images/styles/2x/steampunk.png) steampunk | ![Surrealism](../../images/styles/2x/surrealism.png) surrealism | ![Synthetism](../../images/styles/2x/synthetism.png) synthetism
| ![Synthwave](../../images/styles/2x/synthwave.png) synthwave | ![Vaporwave](../../images/styles/2x/vaporwave.png) vaporwave | ![Acrylic paint](../../images/styles/2x/acrylic-paint.png) acrylic_paint
| ![Bold lines](../../images/styles/2x/bold-lines.png) bold_lines | ![Chiaroscuro](../../images/styles/2x/chiaroscuro.png) chiaroscuro | ![Color shift art](../../images/styles/2x/color-shift-art.png) color_shift_art
| ![Daguerreotype](../../images/styles/2x/daguerreotype.png) daguerreotype | ![Digital fractal](../../images/styles/2x/digital-fractal.png) digital_fractal | ![Doodle drawing](../../images/styles/2x/doodle-drawing.png) doodle_drawing
| ![Double exposure](../../images/styles/2x/double-exposure.png) double_exposure_portrait | ![Fresco](../../images/styles/2x/fresco.png) fresco | ![Geometric pen](../../images/styles/2x/geometric-pen.png) geometric_pen
| ![Halftone](../../images/styles/2x/halftone.png) halftone | ![Ink](../../images/styles/2x/ink.png) ink | ![Light painting](../../images/styles/2x/light-painting.png) light_painting
| ![Line drawing](../../images/styles/2x/line-drawing.png) line_drawing | ![Linocut](../../images/styles/2x/linocut.png) linocut | ![Oil paint](../../images/styles/2x/oil-paint.png) oil_paint
| ![Paint Spattering](../../images/styles/2x/paint-spattering.png) paint_spattering | ![Painting](../../images/styles/2x/painting.png) painting | ![Palette knife](../../images/styles/2x/palette-knife.png) palette_knife
| ![Photo manipulation](../../images/styles/2x/photo-manipulation.png) photo_manipulation | ![Scribble texture](../../images/styles/2x/scribble-texture.png) scribble_texture |![Sketch](../../images/styles/2x/sketch.png) sketch
| ![Splattering](../../images/styles/2x/splattering.png) splattering | ![Stippling](../../images/styles/2x/stippling.png) stippling_drawing | ![Watercolor](../../images/styles/2x/watercolor.png) watercolor
| ![3d](../../images/styles/2x/3d.png) 3d | ![Anime](../../images/styles/2x/anime.png) anime | ![Cartoon](../../images/styles/2x/cartoon.png) cartoon
| ![Cinematic](../../images/styles/2x/cinematic.png) cinematic | ![Comic book](../../images/styles/2x/comic-book.png) comic_book | ![Concept art](../../images/styles/2x/concept-art.png) concept_art
| ![Cyber matrix](../../images/styles/2x/cyber-matrix.png) cyber_matrix | ![Digital art](../../images/styles/2x/digital-art.png) digital_art | ![Flat design](../../images/styles/2x/flat-design.png) flat_design
| ![Geometric](../../images/styles/2x/geometric.png) geometric | ![Glassmorphism](../../images/styles/2x/glassmorphism.png) glassmorphism | ![Glitch graphic](../../images/styles/2x/glitch-graphic.png) glitch_graphic
| ![Graffiti](../../images/styles/2x/graffiti.png) graffiti | ![Hyper realistic](../../images/styles/2x/hyper-realistic.png) hyper_realistic | ![Interior design](../../images/styles/2x/interior-design.png) interior_design
| ![Line gradient](../../images/styles/2x/line-gradient.png) line_gradient | ![Low poly](../../images/styles/2x/low-poly.png) low_poly | ![Newspaper collage](../../images/styles/2x/newspaper-collage.png) newspaper_collage
| ![Optical illusion](../../images/styles/2x/optical-illusion.png) optical_illusion | ![Pattern pixel](../../images/styles/2x/pattern-pixel.png) pattern_pixel | ![Pixel art](../../images/styles/2x/pixel-art.png) pixel_art
| ![Pop art](../../images/styles/2x/pop-art.png) pop_art | ![Product photo](../../images/styles/2x/product-photo.png) product_photo | ![Psychedelic background](../../images/styles/2x/psychedelic-background.png) psychedelic_background
| ![Psychedelic wonderland](../../images/styles/2x/psychedelic-wonderland.png) psychedelic_wonderland | ![Scandinavian](../../images/styles/2x/scandinavian.png) scandinavian | ![Splash images](../../images/styles/2x/splash-images.png) splash_images
| ![Stamp](../../images/styles/2x/stamp.png) stamp | ![Trompe l'oeil](../../images/styles/2x/trompe-loeil.png) trompe_loeil

## Concepts in action

Let's use style presets to generate a few image variations.

<InlineAlert variant="warning" slots="heading, text" />

Before you start

You'll need a Firefly **Client ID** and **Access Token** for this exercise. Learn how to retrieve them in the [Authentication Guide][2]. **Securely store these credentials and never expose them in client-side or public code.**

1. First, open a secure terminal and `export` your **Client ID** and **Access Token** as environment variables:

```bash
export FIREFLY_SERVICES_CLIENT_ID=<your_Client_ID>
export FIREFLY_SERVICES_ACCESS_TOKEN=<your_Access_Token>
```

2. Next, make the request to the Generate Images API. We'll use a prompt for a Shakespearean puppy, and enter a few presets so that they apply together:

```bash
curl --location 'https://firefly-api.adobe.io/v3/images/generate-async' \
--header 'Content-Type: application/json' \
--header 'Accept: application/json' \
--header "x-api-key: $FIREFLY_SERVICES_CLIENT_ID" \
--header "Authorization: Bearer $FIREFLY_SERVICES_ACCESS_TOKEN" \
--data '{
    "prompt": "a puppy dressed as a renaissance artist",
    "numVariations": 4,
    "style": {
        "presets": [
            "bw", "fantasy", "dramatic_light"
        ]
    }
}'
```

The request returns a rapid response for the asynchronous job:

```json
{   
    "jobId":"<YOUR_JOB_ID>",
    "statusUrl":"https://firefly-epo854211.adobe.io/v3/status/urn:ff:jobs:...",
    "cancelUrl":"https://firefly-epo854211.adobe.io/v3/cancel/urn:ff:jobs:..."
}
```

3. Use the `jobId` to see the result:

<InlineAlert variant="info" slots="heading, text" />

NOTE

The `numVariations` value creates four generated images that will be easy to compare. Four URLs are returned in the response.

```bash
curl -X GET "https://firefly-api.adobe.io/v3/status/<YOUR_JOB_ID>" \
    -H "x-api-key: $FIREFLY_SERVICES_CLIENT_ID" \
    -H "Authorization: Bearer $FIREFLY_SERVICES_ACCESS_TOKEN" \
    -H "Content-Type: application/json"
```

You'll see results similar to our example below. Notice that all the defined presets were applied to the prompt for a renaissance puppy!

**Sample Result**

![A renaissance artist puppy generated with presets][3]

[//]: # (links)
[1]: ../../../api/index.md
[2]: ../../../getting-started/index.md
[3]: ../../images/puppy-renaissance-artist.jpeg
