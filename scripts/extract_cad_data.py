print("--- SCRIPT STARTING ---")
import FreeCAD
import sys
import os
import json

print(f"--- IMPORTS DONE. CWD: {os.getcwd()} ---")

def extract_data(file_path):
    print(f"DEBUG: Attempting to extract from {file_path}")
    
    if not os.path.exists(file_path):
        print(f"ERROR: File not found: {file_path}")
        return

    try:
        print("DEBUG: Opening document...")
        doc = FreeCAD.openDocument(file_path)
        print(f"DEBUG: Document opened: {doc.Label}")
    except Exception as e:
        print(f"ERROR: Could not open document: {e}")
        return

    data = {
        "filename": os.path.basename(file_path),
        "parts": []
    }

    print(f"DEBUG: Doc parsed. Found {len(doc.Objects)} objects.")

    for obj in doc.Objects:
        part_data = {
            "name": obj.Name,
            "label": obj.Label,
            "type_id": obj.TypeId,
            "properties": {}
        }
        
        # Capture standard properties
        for prop in ["Material", "Description", "PartNumber", "Standard", "Label", "Placement"]:
            if hasattr(obj, prop):
                try:
                    val = getattr(obj, prop)
                    part_data["properties"][prop] = str(val)
                except:
                    pass

        data["parts"].append(part_data)

    output_path = file_path.replace(".fcstd", ".json").replace(".FCStd", ".json")
    if output_path == file_path:
        output_path += ".json"

    try:
        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)
        print(f"SUCCESS: Compiled CAD data to {output_path}")
    except Exception as e:
        print(f"ERROR: Failed to write JSON: {e}")

    # FORCE EXIT to prevent hanging
    print("--- SCRIPT FINISHED. EXITING. ---")
    sys.exit(0)

print("--- CALLING EXTRACT_DATA ---")
# Target the SH7 Floor Module file
target_file = "/Volumes/Extreme SSD/Nick/OSE/SH7CAD/SH7 - Floor Module 5.fcstd"
extract_data(target_file)
