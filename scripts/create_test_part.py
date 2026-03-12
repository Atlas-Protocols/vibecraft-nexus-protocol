import FreeCAD
import Part
import os

doc_name = "TestPart"
doc = FreeCAD.newDocument(doc_name)

# Create a simple box
box = doc.addObject("Part::Box", "MyBox")
box.Length = 10
box.Width = 10
box.Height = 10

# Recompute to generate geometry
doc.recompute()

# Save the file
output_path = os.path.join(os.getcwd(), "test_part.FCStd")
doc.saveAs(output_path)

print(f"SUCCESS: Created part and saved to {output_path}")
print(f"Part Info: Shape Type={box.Shape.ShapeType}, Volume={box.Shape.Volume}")
