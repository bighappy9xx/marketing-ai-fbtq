import os, runpy, sys
from pathlib import Path
# Preserve Library identity on NTFS using named metadata streams.
if os.name == 'nt' and not hasattr(os, 'setxattr'):
    def stream_path(path, name):
        name = os.fsdecode(name)
        if '/' in name or '\\' in name or ':' in name:
            raise ValueError('Invalid metadata name')
        return os.fspath(path) + ':' + name
    def set_attribute(path, name, value, *args, **kwargs):
        with open(stream_path(path, name), 'wb') as stream:
            stream.write(value)
    def get_attribute(path, name, *args, **kwargs):
        with open(stream_path(path, name), 'rb') as stream:
            return stream.read()
    os.setxattr = set_attribute
    os.getxattr = get_attribute
helper = Path(__file__).with_name('library_file_transfer.py')
sys.argv[0] = str(helper)
runpy.run_path(str(helper), run_name='__main__')
