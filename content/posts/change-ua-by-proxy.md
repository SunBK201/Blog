---
title: "全新方案-懒人福音-无需手动编译修改UA-校园网防检测"
date: 2021-05-30
draft: false
---

[校园网防检测: UA3F - 新一代 UA 修改方法](https://blog.sunbk201.site/posts/ua3f/)

[关于某大学校园网共享上网检测机制的研究与解决方案](https://blog.sunbk201.site/crack-campus-network)

[OpenWrt 编译与防检测部署教程](https://blog.sunbk201.site/posts/openwrt-compile)

阅读过上面两篇文章的同学可以发现，手动编译OpenWrt是一件很痛苦的事。 显然对于一些动手能力不强的同学来说，通过 UA2F 修改UA是比较困难的。而且，UA2F从设计层面上也存在一些问题，例如无法处理网卡分包等情况。

因此，我们需要一种更加简单的方案，既能无需编译OpenWrt，又能更好的满足我们的需求。

之前我曾经提到过我们可以通过加密流量来实现防检测，但我当时并没有采取这个策略，因为进行全局加密网络流畅度影响太大， 而进行部分加密目前市面上还没有很好的解决方案（之前是这么认为），目前大多数加密软件都是基于规则的加密，但支持的多为针对域名的加密。

然而我们的需求是针对http应用层的加密，这类加密方案目前支持的不多。

经过我深入了解，Clash 中 DstPort 是我们最理想的规则选项，我们可以指定代理目标端口为http的80端口从而实现http应用层的加密。

此外，除了针对http的加密外，我们还可以通过支持Mitm的网络调试工具对http中UA进行重写以达到修改UA的目的。

基于上面的分析，我总结了以下方案：

# Windows 用户
使用 Clash，添加规则：
```
- DST-PORT,80,proxy
```
加入以上规则即可实现针对 80 端口的加密

# Andorid 用户
使用 Clash，添加规则：

```
- DST-PORT,80,proxy
```
加入以上规则即可实现针对80 端口的加密

# iOS & Mac 用户
使用 Quantumult X/Surge 等支持重写的工具，添加重写规则：
```
# Quantumult X
^http:// url request-header (\r\n)User-[A|a]gent:.+(\r\n) request-header $1User-Agent: F$2
```
```
# Surge
^http:// header-replace User-Agent F
```
加入以上规则即可实现针对 UA 的重写

# OpenWrt 配置
使用 OpenClash，添加规则：
```
- DST-PORT,80,proxy
```
如果在 OpenWrt 加入这条配置，那么就无需进行其他终端的配置了。

# 其他
对于 TTL 和 NTP 方面，我们无需进行手动编译，常见的 OpenWrt 固件都能够默认支持。 对于 IPID，我认为无需关注，基于 IPID 的检测我认为是不现实且很少见的。

如果有疑问可以加讨论组：[Telegram](https://t.me/crack_campus_network)