# FitCheck 60-Second Demo Script

“Buying furniture and decor online breaks down when customers cannot tell what
will actually fit. In this chatbot-first flow, the shopper uploads a room image
and asks in chat: find me a plant that will fit on this table.

FitCheck uses Subconscious TIM-Qwen3.6 for the visual reasoning story. It
identifies the target surface with confidence, applies the detected table
dimensions, and adds real-world constraints: tabletop clearance and whether the
plant will block the TV sightline.

The assistant keeps this flow minimal: it returns only the best-fit product plus
one newly generated composite preview image on top of the uploaded room photo.
The generated image keeps confidence and size labels visible.

The best match is compact enough for the 34 inch table and stays below the
sightline limit. A larger monstera looks nice but is flagged as a poor fit
because it is too tall and uses too much tabletop space.

This turns a vague image-based shopping request into a confident purchase
decision, reducing abandoned carts and returns caused by dimension uncertainty.”

## Click Path

1. Open the app at `http://localhost:3000`.
2. Upload or show the bundled room image.
3. Keep the prompt: “Find me a plant that will fit on this table without
   blocking the TV.”
4. Ask: “Show only the best fit and generate the preview image.”
5. Show the best-fit card and the single generated image output.
6. Confirm that no extra explanatory text appears in the assistant response.
7. (Optional) Open `http://localhost:3000/fitcheck-demo` for the standalone
   visual component.
