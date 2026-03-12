#!/usr/bin/env python3
import sys
import os

# FreeCAD library path on macOS (standard installation)
# This path was found via: find /Applications/FreeCAD.app -name "FreeCAD.so"
FREECAD_LIB_PATH = '/Applications/FreeCAD.app/Contents/Resources/lib'

# Add FreeCAD lib path to system path
if FREECAD_LIB_PATH not in sys.path:
    sys.path.append(FREECAD_LIB_PATH)

try:
    import FreeCAD
    print(f"SUCCESS: FreeCAD module imported.")
    print(f"Version: {FreeCAD.Version()}")
except ImportError as e:
    print(f"ERROR: Could not import FreeCAD module.")
    print(f"Python Path: {sys.path}")
    print(f"Details: {e}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: An unexpected error occurred.")
    print(f"Details: {e}")
    sys.exit(1)
