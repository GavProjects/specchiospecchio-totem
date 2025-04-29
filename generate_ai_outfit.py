
import requests
import base64
import os

INPUT_DIR = "input"
OUTPUT_DIR = "output"
API_URL = "http://127.0.0.1:7860"

def load_image_as_base64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def generate_image():
    user_img_path = os.path.join(INPUT_DIR, "6.jpg")
    if not os.path.exists(user_img_path):
        raise FileNotFoundError("6.jpg mancante in /input/")
    
    control_image_b64 = load_image_as_base64(user_img_path)

    payload = {
        "init_images": [control_image_b64],
        "prompt": "a man wearing the outfit shown in the reference image, realistic, full body, fashion photo",
        "negative_prompt": "bad quality, distorted, blur, ugly",
        "sampler_name": "DPM++ 2M",
        "steps": 20,
        "cfg_scale": 7,
        "denoising_strength": 0.55,
        "width": 512,
        "height": 768,
        "alwayson_scripts": {
            "controlnet": {
                "args": [
                    {
                        "enabled": True,
                        "input_image": control_image_b64,
                        "module": "openpose",
                        "model": "control_sd15_openpose [fef5e48e]",
                        "weight": 1.0,
                        "resize_mode": "Scale to Fit",
                        "lowvram": False,
                        "processor_res": 512,
                        "guidance_start": 0.0,
                        "guidance_end": 1.0,
                        "control_mode": 0,
                        "pixel_perfect": True
                    }
                ]
            }
        }
    }

    response = requests.post(url=f"{API_URL}/sdapi/v1/img2img", json=payload)
    if response.status_code == 200:
        result = response.json()
        image_data = result['images'][0]
        image_bytes = base64.b64decode(image_data.split(",",1)[1])
        output_path = os.path.join(OUTPUT_DIR, "ai_outfit_result.png")
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(output_path, "wb") as out_file:
            out_file.write(image_bytes)
        print(f"✅ Immagine generata: {output_path}")
    else:
        print("❌ Errore nella richiesta:", response.status_code)

if __name__ == "__main__":
    generate_image()
