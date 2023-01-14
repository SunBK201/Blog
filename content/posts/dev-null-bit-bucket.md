---
title: "什么是 /dev/null：介绍一下比特桶 (Bit Bucket)"
date: 2021-06-14
draft: false
---

如果你之前曾经使用过 Linux，你很有可能遇到过比特桶 (Bit Bucket)，通常写为 `/dev/null`。了解这个特殊的文件是如何工作的以及它的重要性，有利于使之成为我们极有用的工具。我们将讨论什么是 `/dev/null`，如何使用它，以及为什么它为什么叫做比特桶。我们还将探讨一些例子，说明它在通常情况下是如何使用的。

# 为什么叫 “比特桶”？
早期的计算机使用打孔卡来存储数据和编程代码。当机器打完孔后，未使用的材料会掉进一个桶里。随着时间的推移，比特桶成为一个通用术语，指的是一个丢弃无用比特的地方。

`/dev/null` 的其他名字是 black hole、null route、punch bucket、null device，或者只是 null。

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/1280px-Univac_bit_bucket.JPG)

# /dev/null 文件
`/dev/null` 文件是一个在启动时产生的伪设备文件。它没有大小（0字节），在磁盘上占用 0 个块，对所有用户都有读/写权限。下面的截图显示，该文件和上次系统重启的日期和时间相同。

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210613201532.png)

这是一个被称为字符设备文件的特殊文件。这允许该文件像一个设备（空设备）一样运作，它没有缓冲，可以接受数据流。当你访问一个设备文件时，你是在与一个驱动程序进行通信。在 `/dev/null` 的情况中，它就像一个带有驱动程序的有具体用途的伪设备。它会丢弃你写给它的任何东西，并且只在读取时返回一个 EOF 字符。发送 EOF 或多或少意味着让进程意识到不会有更多的输入被发送（End of File）。

# /dev/null 文件的使用
## 使用 /dev/null 抑制输出
`/dev/null` 文件最常被用来抑制输出。在下面的例子中，我们使用 `>` 重定向操作符，将 [stat 命令](https://www.putorius.net/linux-stat-command.html) 的输出发送到比特桶中。
```bash
stat /etc/passwd > /dev/null
```
这样做有效地抑制了输出的命令（标准输出）。

我们可以使用 `/dev/null`，通过重定向标准错误（STDERR）来抑制错误输出，如下：
```bash
stat /etc/passwdss 2> /dev/null
```
我们把文件名改为 passwdss，但它并不存在。这通常会显示一个 “No such file or directory “的错误。不过，由于我们将 STDERR（标准错误）输出重定向到 `/dev/null`，所以这个错误被丢弃了。

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/ani-diag1-min.gif)

注意: 要了解更多关于重定向和标准数据流（STDIN、STDOUT、STDERR）的知识，请阅读 [Linux I/O, Standard Streams, and Redirection](https://www.putorius.net/linux-io-file-descriptors-and-redirection.html)。

注意: 发送到 `/dev/null` 的数据会被立即丢弃，无法恢复。

## 使用 /dev/null 来输入 EOF（End of File）

`/dev/null` 的另一个常见用途是提供一个空白或空的输入，除了EOF字符外什么都没有。你可能并不清楚为什么需要这样一个函数。然而，有很多工具需要一个EOF字符才能进行。例如，mailx 工具将允许你从命令行中输入一个电子邮件。它会一直等待输入，直到它收到一个EOF字符，这个字符是通过点击 CTRL + D 来发送的。

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/ani-diag-mail-fast-min.gif)

注意：EOT（传输结束）和 EOF（文件结束）有技术上的差异，归结为编码问题，不在本教程的范围内。

如果我们想发送一封空白的电子邮件，我们将不得不进入交互式模式，并点击 CTRL + D，没有输入。如果是在脚本或其他无人看管的情况下使用，这将是不切实际的。作为一种变通方法，我们可以将 `/dev/null` 重定向到 mailx 命令中，让它为我们做这件事。

```
mailx -s "Just Another Email" user@putorius.net < /dev/null
Null message body; hope that's ok
```

### 使用 /dev/null 来清空一个文件
`/dev/null` 文件的另一个常见用途是清空文件的内容。如果你使用 `>` 重定向操作符将 `/dev/null` 重定向到一个文件中，它将有效地删除该文件的内容。

```bash
sunbk201@BKALIEN:~$ ls -l scp.log
-rw-r--r-- 1 sunbk201 sunbk201 13 Jun 13 20:48 scp.log
sunbk201@BKALIEN:~$ cat /dev/null > scp.log
sunbk201@BKALIEN:~$ ls -l scp.log
-rw-r--r-- 1 sunbk201 sunbk201 0 Jun 13 20:48 scp.log
sunbk201@BKALIEN:~$ cat scp.log
```

另一个选择是使用 `cp` 命令将 `/dev/null` 复制到该文件上，像这样：
```bash
sunbk201@BKALIEN:~$ ls -l scp.log
-rw-r--r-- 1 sunbk201 sunbk201 13 Jun 13 20:49 scp.log
sunbk201@BKALIEN:~$ cp /dev/null scp.log
sunbk201@BKALIEN:~$ ls -l scp.log
-rw-r--r-- 1 sunbk201 sunbk201 0 Jun 13 20:50 scp.log
```

# 总结
比特桶（/dev/null）对于系统管理员、开发工程师和几乎所有使用命令行的人来说都是一个重要而有用的工具。在这篇文章中，我们讨论了 `/dev/null` 的一些最常见的用途，一旦你知道它的作用，你可能会发现越来越多的使用方法。

Resource and Links:
- [Null Man Page](https://linux.die.net/man/4/null)
- [Linux I/O, Standard Streams, and Redirection](https://www.putorius.net/linux-io-file-descriptors-and-redirection.html)
- [Bit Bucket – WikiPedia](https://en.wikipedia.org/wiki/Bit_bucket)
- [Null Device – WikPedia](https://en.wikipedia.org/wiki/Null_device)

This is a version from [putorius](https://www.putorius.net/).