#!/usr/bin/env python3
"""
OSE Batch CAD Processor
Processes all FreeCAD files in a directory tree, extracting JSON and generating Platinum instructions.
"""

import os
import sys
import subprocess
import json
from pathlib import Path
from datetime import datetime

# Configuration
FREECAD_PATH = "/Applications/FreeCAD.app/Contents/Resources/bin/FreeCADCmd"
EXTRACT_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extract_cad_data.py")
WEAVE_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weave_instructions.py")

def find_fcstd_files(root_dir):
    """Find all .fcstd files in directory tree."""
    fcstd_files = []
    for root, dirs, files in os.walk(root_dir):
        # Skip ARCHIVE directories
        if 'ARCHIVE' in root:
            continue
        for file in files:
            if file.endswith('.fcstd') and not file.startswith('._'):
                fcstd_files.append(os.path.join(root, file))
    return fcstd_files


def process_single_file(fcstd_path, output_dir=None):
    """Process a single FreeCAD file."""
    print(f"\n{'='*60}")
    print(f"Processing: {os.path.basename(fcstd_path)}")
    print(f"{'='*60}")
    
    if output_dir is None:
        output_dir = os.path.dirname(fcstd_path)
    
    base_name = os.path.splitext(os.path.basename(fcstd_path))[0]
    json_path = os.path.join(output_dir, f"{base_name}.json")
    md_path = os.path.join(output_dir, f"{base_name}_Instructions.md")
    
    # Step 1: Extract CAD data (using FreeCAD Python)
    extract_code = f'''
import FreeCAD
import json
import sys

def extract_data(filepath):
    try:
        doc = FreeCAD.openDocument(filepath)
        data = {{
            "filename": "{os.path.basename(fcstd_path)}",
            "parts": []
        }}
        
        for obj in doc.Objects:
            part = {{
                "name": obj.Name,
                "label": obj.Label if hasattr(obj, "Label") else obj.Name,
                "type_id": obj.TypeId,
                "properties": {{}}
            }}
            
            if hasattr(obj, "Label"):
                part["properties"]["Label"] = obj.Label
            if hasattr(obj, "Placement"):
                part["properties"]["Placement"] = str(obj.Placement)
            
            data["parts"].append(part)
        
        with open("{json_path}", "w") as f:
            json.dump(data, f, indent=2)
        
        print(f"SUCCESS: Extracted {{len(data['parts'])}} parts to {json_path}")
        FreeCAD.closeDocument(doc.Name)
        return True
    except Exception as e:
        print(f"ERROR: {{e}}")
        return False

extract_data("{fcstd_path}")
FreeCAD.closeDocument(FreeCAD.ActiveDocument.Name) if FreeCAD.ActiveDocument else None
'''
    
    # Write temp script
    temp_script = "/tmp/extract_temp.py"
    with open(temp_script, 'w') as f:
        f.write(extract_code)
    
    # Run FreeCAD extraction
    try:
        result = subprocess.run(
            [FREECAD_PATH, "--console", temp_script],
            capture_output=True,
            text=True,
            timeout=120
        )
        if "SUCCESS" in result.stdout or os.path.exists(json_path):
            print(f"  ✅ Extracted: {json_path}")
        else:
            print(f"  ❌ Extraction failed: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"  ⚠️ Timeout on extraction")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False
    
    # Step 2: Generate Platinum instructions
    if os.path.exists(json_path):
        try:
            result = subprocess.run(
                ["python3", WEAVE_SCRIPT, json_path, md_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            if os.path.exists(md_path):
                print(f"  ✅ Instructions: {md_path}")
                return True
            else:
                print(f"  ❌ Weave failed: {result.stderr[:200]}")
                return False
        except Exception as e:
            print(f"  ❌ Weave error: {e}")
            return False
    
    return False


def batch_process(root_dir, output_dir=None):
    """Process all FreeCAD files in directory tree."""
    print(f"\n{'#'*60}")
    print(f"# OSE Batch CAD Processor")
    print(f"# Root: {root_dir}")
    print(f"# Started: {datetime.now().isoformat()}")
    print(f"{'#'*60}")
    
    files = find_fcstd_files(root_dir)
    print(f"\nFound {len(files)} .fcstd files to process")
    
    results = {"success": [], "failed": []}
    
    for i, fcstd_path in enumerate(files, 1):
        print(f"\n[{i}/{len(files)}] ", end="")
        if process_single_file(fcstd_path, output_dir):
            results["success"].append(fcstd_path)
        else:
            results["failed"].append(fcstd_path)
    
    # Summary
    print(f"\n{'#'*60}")
    print(f"# BATCH COMPLETE")
    print(f"# Success: {len(results['success'])}")
    print(f"# Failed: {len(results['failed'])}")
    print(f"{'#'*60}")
    
    if results["failed"]:
        print("\nFailed files:")
        for f in results["failed"]:
            print(f"  - {f}")
    
    return results


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: batch_process.py <root_directory> [output_directory]")
        print("  Processes all .fcstd files in directory tree")
        sys.exit(1)
    
    root_dir = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None
    
    batch_process(root_dir, output_dir)
