class FullStitch:
    def __init__(self, x, y, palindex):
        self.x = x
        self.y = y
        self.palindex = palindex


class Response:
    def __init__(self, status, result, message=None):
        self.status = status
        self.result = result
        self.message = message


class StitchesPerInch:
    def __init__(self, x, y):
        self.x = x
        self.y = y


class Fabric:
    def __init__(self, width, height, spi, kind, name, color):
        self.width = width
        self.height = height
        self.spi = spi
        self.kind = kind
        self.name = name
        self.color = color


class PaletteItem:
    def __init__(self, brand, number, name, color):
        self.brand = brand
        self.number = number
        self.name = name
        self.color = color


class Pattern:
    def __init__(self, fabric, palette, fullstitches):
        self.fabric = fabric
        self.palette = palette
        self.fullstitches = fullstitches


class PatternProject:
    def __init__(self, pattern):
        self.pattern = pattern


class XsdParseData:
    def __init__(self):
        self.width = 0
        self.height = 0
        self.colors = []

    def get_width(self):
        return self.width

    def set_width(self, width):
        self.width = width

    def get_height(self):
        return self.height

    def set_height(self, height):
        self.height = height

    def get_colors(self):
        return self.colors

    def set_colors(self, colors):
        self.colors = colors    