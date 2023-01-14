---
title: "1500 字节是如何成为互联网的 MTU 的？"
date: 2021-07-15
draft: false
---

以太网无处不在，数以万计的硬件供应商都在讨论和实现它。然而，几乎每个以太网链路都都有一个共同的数字，那就是 MTU：

```bash
$ ip l
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
2: enp5s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP 
    link/ether xx:xx:xx:xx:xx:xx brd ff:ff:ff:ff:ff:ff
```

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210715135605.png)

MTU（最大传输单元）规定了一个数据包可以有多大。一般来说，当你在自己的局域网上与其他设备通信时，MTU 大约为 1500 字节，互联网也几乎普遍采用 1500 字节。然而，这并不意味着这些链路层技术不能传输更大的数据包。

例如，802.11（WiFi）的 MTU 为 2304 字节，或者如果你的网络使用 [FDDI](https://en.wikipedia.org/wiki/Fiber_Distributed_Data_Interface)，那么你的 MTU 约为 4352 字节。以太网本身有一个 “巨型帧 “的概念，MTU 可以设置为 9000 字节（在支持的网卡、交换机和路由器上）。

然而，这些设定在互联网上几乎无关大局。由于互联网的骨干网现在大多是由以太网链路组成的，因此事实上数据包的最大尺寸现在被非正式地设定为 1500 字节，以避免数据包在链路上被分片。

从表面上看，1500 是一个奇怪的数字，我们通常期望计算中的许多常数都是基于数学常量的，比如 2 的幂。

那么，1500 是怎么来的，为什么我们还在使用它？

# 神奇的数字
以太网的第一次重大突破是以 10BASE-2（廉价网）和 10BASE-5（稠密网）的形式出现的，这些数字大致表明一个网段可以跨越多少百米。

由于当时有许多竞争性协议，而且存在硬件限制，以太网原作者在一封电子邮件中指出，数据包缓冲区的内存要求在神奇的 1500 数字上有一些作用。

> 回过头来看，一个较长的最大值可能会更好，但如果它在早期增加了网卡的成本，可能会阻止以太网的广泛接受。

然而，这并不是故事的全部。1980年发表的 [Ethernet: Distributed Packet Switching for Local Computer Networks](https://blog.benjojo.co.uk/asset/4Up5QvCjAa) 一文是对网络上较大数据包的效率成本分析的早期说明。这在当时对以太网特别重要，因为以太网网络将在所有系统之间共享相同的同轴电缆，或者以太网集线器，一次只允许一个数据包在以太网段的所有成员之间传输。

我们必须选择一个数字，使得数据在这些共享（有时是繁忙的）网段上的传输延迟不会太高，但这也意味着数据包头的开销不会太大。(见上面链接的论文第 15-16 页的一些表格)

看来，当时的工程师们最多只挑选了 1500 字节，或大约 12000 比特作为最佳"安全"值。

从那时起，各种其他的传输系统陆续出现，但其中最低的MTU值仍然是以太网的 1500 字节。大于网络上的最低 MTU 将导致 IP 分片，或者需要进行路径 MTU 检测。这两种情况都有各自的问题。即使是大型操作系统供应商有时也会将默认 [MTU](https://archive.nanog.org/mailinglist/mailarchives/old_archive/1998-02/msg00064.html) 降到更低。

# 效率问题
所以现在我们知道，互联网的 MTU 上限为1500，主要是由于传统的延迟数字和硬件限制，这对互联网的效率有多大影响？

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210715141919.png)

如果我们看一下一个主要的互联网流量交换点（AMS-IX）的数据，我们会发现，至少有20%经过交换点的数据包是最大尺寸的。我们还可以看到局域网的总流量：

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210715142133.png)

如果你把这两张图结合起来，你得到的结果大致上是这样的。这是对每个数据包大小区间的流量的估计。

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210715142242.png)

或者，如果我们只看所有这些以太网序言和报头引起的流量，我们会得到同样的图表，但有不同的尺度。

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210715142400.png)

这表明大量的带宽被花在最大的数据包类的包头上。由于峰值流量显示最大的数据包桶的开销约为 246GBit/s，我们可以假设，如果我们在有条件的情况下都采用了巨型帧，那么这个开销将只有约 41GBit/s。

但我认为在这一点上，宽广的互联网上已经有人这样做过。虽然一些[互联网通信公司以 9000MTU 运营](https://web.archive.org/web/20200108213905/https://he.net/ip_transit.html)，但绝大多数并非如此，而且一次又一次地[证明](https://en.wikipedia.org/wiki/IPv6_deployment)，共同改变互联网的想法是非常困难的。

This is a version from [benjojo](https://blog.benjojo.co.uk/).