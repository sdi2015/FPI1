import re
import sys
import zipfile
import xml.etree.ElementTree as ET

path = sys.argv[1]
NS = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'

def col(cellref):
    letters = re.match(r'([A-Z]+)', cellref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1

with zipfile.ZipFile(path) as z:
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    relmap = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels}
    sheets = []
    for s in wb.find('a:sheets', NS):
        target = relmap[s.attrib[RID]].lstrip('/')
        sheets.append((s.attrib['name'], target if target.startswith('xl/') else 'xl/' + target))
    print('sheets', sheets)

    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall('a:si', NS):
            shared.append(''.join(t.text or '' for t in si.findall('.//a:t', NS)))

    def val(c):
        t = c.attrib.get('t')
        v = c.find('a:v', NS)
        if t == 's' and v is not None:
            return shared[int(v.text)]
        if t == 'inlineStr':
            return ''.join(x.text or '' for x in c.findall('.//a:t', NS))
        return v.text if v is not None else ''

    for name, sheetpath in sheets:
        root = ET.fromstring(z.read(sheetpath))
        allrows = root.findall('.//a:sheetData/a:row', NS)
        print('\nSHEET', name, 'rows', len(allrows))
        for row in allrows[:8]:
            arr = []
            for c in row.findall('a:c', NS):
                idx = col(c.attrib['r'])
                while len(arr) <= idx:
                    arr.append('')
                arr[idx] = val(c)
            print(row.attrib.get('r'), arr[:40])
