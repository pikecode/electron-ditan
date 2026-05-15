import argparse
from xsd_parser import XsdParser
from exceptions import ParseException


def main():
    parser = argparse.ArgumentParser(description='Parse XSD file to extract pattern data')
    parser.add_argument('--file', help='Path to the XSD file', required=True)
    args = parser.parse_args()

    try:
        # 解析XSD文件
        project = XsdParser.parse_xsd_file("/Users/Tony/Desktop/5个文件/资料/5个文件/BX1.xsd")
        
        if project:
            # 转换为解析数据
            parse_data = XsdParser.convert_xsd_parse_data(project)
            
            # 打印解析结果
            print(f"Pattern Width: {parse_data.get_width()}")
            print(f"Pattern Height: {parse_data.get_height()}")
            print(f"Number of Stitches: {len(parse_data.get_colors())}")
            print(f"First 5 colors: {parse_data.get_colors()[:5]}")
        else:
            print("Failed to parse the XSD file.")
            
    except ParseException as e:
        print(f"Error: {e}")
        if e.cause:
            print(f"Caused by: {e.cause}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")


if __name__ == "__main__":
    main()    