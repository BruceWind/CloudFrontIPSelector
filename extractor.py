import csv

# 打开输入文件和输出文件
with open('dbip-country-ipv4.csv', 'r') as input_file, open('JP-ipv4.csv', 'w', newline='') as output_file:
    # 创建 CSV 读写对象
    reader = csv.reader(input_file)
    writer = csv.writer(output_file)

    # 逐行读取输入文件，判断并写入输出文件
    for row in reader:
        if row[-1][-2:] == 'JP':
            writer.writerow(row)
