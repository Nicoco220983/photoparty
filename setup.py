from setuptools import setup, find_packages

setup(
    name='photoparty',
    version='0.1.0',    
    description='MSA package to take and show photo during a party',
    author='Nicolas Carrez',
    author_email='nicolas.carrez@gmail.com',
    license='BSD 2-clause',
    packages=find_packages(),
    package_data={'photoparty': ['static/*']},
    include_package_data=True,
    install_requires=[
        'fastapi',
        'aiofiles',
        'python-multipart',
        'Pillow',
        'qrcode[pil]',
    ],
)
