#!/usr/bin/env python3
"""
OSE Consolidator v1.0
Merges individual module instructions into a single, cohesive handbook.
Handles cross-linking and logical ordering.
"""

import os
import re
from datetime import datetime

def consolidate(input_dir, output_file):
    print(f"Consolidating instructions from {input_dir}...")
    
    # Get all markdown files in the directory
    md_files = [f for f in os.listdir(input_dir) if f.endswith("_Instructions.md")]
    
    # Sort files logically (Floor -> Walls -> Roof -> Other)
    def sort_key(filename):
        if "Floor" in filename:
            return (0, filename)
        if "Wall" in filename:
            return (1, filename)
        if "Roof" in filename:
            return (2, filename)
        if "Veranda" in filename:
            return (3, filename)
        return (4, filename)
    
    md_files.sort(key=sort_key)
    
    master_content = []
    
    # Header
    master_content.append("# OSE Seed Home 7 - Complete Construction Handbook")
    master_content.append("> **Platinum Edition | Automated Documentation Suite**")
    master_content.append(f"> Date: {datetime.now().strftime('%B %d, %Y')}")
    master_content.append("")
    master_content.append("---")
    master_content.append("")
    master_content.append("## 📚 Table of Contents")
    
    # Generate TOC
    for f in md_files:
        title = f.replace("_Instructions.md", "").replace("_", " ")
        anchor = title.lower().replace(" ", "-")
        master_content.append(f"- [{title}](#{anchor})")
    
    master_content.append("")
    master_content.append("---")
    master_content.append("<div style='page-break-after: always;'></div>")
    master_content.append("")
    
    # Merge contents
    for f in md_files:
        filepath = os.path.join(input_dir, f)
        title = f.replace("_Instructions.md", "").replace("_", " ")
        anchor = title.lower().replace(" ", "-")
        
        with open(filepath, "r") as src:
            content = src.read()
            
            # Add an anchor for the TOC
            master_content.append(f"<a name='{anchor}'></a>")
            
            # Strip the main title from the individual file to avoid double headers
            # (Assuming individual files start with # Title)
            lines = content.split("\n")
            if lines[0].startswith("# "):
                lines = lines[1:]
            
            master_content.append(f"## {title}")
            master_content.extend(lines)
            
            master_content.append("")
            master_content.append("---")
            master_content.append("<div style='page-break-after: always;'></div>")
            master_content.append("")
            
    # Write output
    with open(output_file, "w") as out:
        out.write("\n".join(master_content))
        
    print(f"✅ SUCCESS: Consolidated {len(md_files)} manuals into {output_file}")

if __name__ == "__main__":
    import sys
    input_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    output_file = sys.argv[2] if len(sys.argv) > 2 else "OSE_Complete_Handbook.md"
    consolidate(input_dir, output_file)
