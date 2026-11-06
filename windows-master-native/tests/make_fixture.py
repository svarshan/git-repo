import pycdlib
from pathlib import Path
Path('fixture.txt').write_bytes(b'MoOLVa test fixture')
i=pycdlib.PyCdlib()
i.new(interchange_level=3)
for directory in ['/SOURCES','/EFI','/EFI/BOOT']:
    i.add_directory(directory)
for filename in ['/HELLO.TXT;1','/SETUP.EXE;1','/SOURCES/BOOT.WIM;1','/SOURCES/INSTALL.WIM;1','/EFI/BOOT/BOOTX64.EFI;1']:
    i.add_file('fixture.txt',filename)
i.write('fixture.iso')
i.close()
