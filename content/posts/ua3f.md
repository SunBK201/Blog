---
title: "校园网防检测: UA3F - 新一代 UA 修改方法"
date: 2023-12-03T03:37:08+08:00
draft: false
---

# 太长不看（写于 2025.11）
修改 User-Agent 字段：使用 [UA3F](https://github.com/SunBK201/UA3F)，默认配置开箱即用，ipk 安装即可。

UA3F 的使用教程见：[猴子也能看懂的 UA3F 使用教程](https://sunbk201public.notion.site/UA3F-2a21f32cbb4b80669e04ec1f053d0333)

# 前言
目前众多高校依旧对校园网络共享行为进行严格限制，具体表现为：
- 对每人接入校园网络的设备数量进行限制
- 如果存在接入路由器并存在多人使用时，将采取断网、封禁等惩罚措施

为了能够绕过校园网的接入设备数量的限制，有众多同仁对校园网的共享检测机制进行研究，我也在 [关于某大学校园网共享上网检测机制的研究与解决方案](https://blog.sunbk201.site/crack-campus-network) 一文中归纳总结出校园网的共享检测常见方法：
- TTL 字段的检测
- HTTP User-Agent 头部检测
- DPI 检测技术
- IPv4 Identification 字段
- 时钟偏移的检测技术
- Flash Cookie 检测

其中上述的一部分方法随着历史原因与技术的迭代已经被废弃：
- Flash Cookie 检测: 随着 HTML5 与 WebGL 等技术的出现，Flash 已经于 2020 年退出历史舞台
- IPv4 Identification 字段: 经过验证 iPhone、Mac 等移动设备的 Identification 会保持为 0

而剩下的时钟偏移的检测实际落地应用场景有待考证，DPI 检测技术由于会对网络设备造成过高的负载压力，因此部分高校可能不会开启此功能。

对于 TTL 字段的检测，目前已有成熟有效的方法能够绕过检测，即利用 netfilter/iptables 对 TTL 进行修改即可。
那么目前防检测方案唯一有待优化的就是剩下来的 HTTP User-Agent 头部检测，而 User-Agent 头部检测也是目前各大高校最常用的防共享检测方案之一。
在之前的工作中，有同仁提出了 XMURP-UA，一个用于修改 User-Agent 的内核模块，但是存在性能以及无法处理 80 端口以外的流量等问题；为了弥补 XMURP-UA 的端口覆盖不全的问题，UA2F 被提出，其最大的贡献在于借助 libnetfilter_queue 将 TCP Flow 进行 HTTP 解析并将 UA 修改，该方法能够处理任意端口流量。

但是经过长期的实践，UA2F 存在以下问题：
- 由于依赖于 netfilter/libnetfilter_queue 的外部动态库，因此实际构建与部署较为复杂，需要涉及对 OpenWrt 的交叉编译，对用户存在门槛。
- UA2F 依赖于 netfilter/iptables 进行流重定向，因此与 Clash 等代理工具存在冲突问题，因此对于依赖于 Clash 等代理工具的用户，不得不采用二级路由的形式已实现 Clash 与 UA2F 的共存。

# UA3F: 新一代 UA 修改方法
为了解决上述 UA2F 存在的问题，我提出一种全新的 HTTP User-Agent 修改方法: [UA3F](https://github.com/SunBK201/UA3F)

![UA3F](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/ua3f)

由上图所示，UA3F 依赖于 Clash 等基于规则的代理工具，UA3F 本身最为一个 SOCKS5 代理对本机提供服务，借助 Clash，UA3F 能够捕获入站全部流量，由 Clash 向 UA3F 转发的全部潜在的 HTTP 流量，这里值得注意的是，UA3F 可以接受任何基于 TCP 协议的流量，但是只关注于 HTTP，UA3F 会尝试解析 TCP 流并判断当前连接是否承载 HTTP 流量，如果判定非 HTTP 连接，则直接转发，如果判定为 HTTP 连接，则进行 HTTP 流量解析并定位修改 User-Agent 头部。

通过上述方式，UA3F 可以做到：
- 与 Clash 共存
- 借助 Clash 的流量重定向，UA3F 可以截获到全部 HTTP 流量
- UA3F 对外作为一个定制的 SOCKS5 代理，与 Clash 部署到同一路由器设备，相当于将远程的代理服务器转移到本地，由本地进行流量转发处理，因此 UA3F 依赖 Clash 但并不需要外部远程代理服务器进行加密代理转发。
- 自定义 UA 内容

# UA3F 使用

```bash
# 无参数执行，默认监听端口为 1080，默认 UA 修改为 FFF
./ua3f

# 可以修改监听端口与自定义 UA
# 以下通过下面参数可以让 UA3F 监听端口为 8080，UA 修改为 HELLO
./ua3f -p 8080 -f HELLO
```

UA3F 作为一个 SOCK5 服务，Clash 可以十分方便进行配接入，下面提供一个 Clash 的配置用于接入：
```yaml
proxies:
  - name: "ua3f"
    type: socks5
    server: 127.0.0.1
    port: 1080
    url: http://connectivitycheck.platform.hicloud.com/generate_204

rules:
  - PROCESS-NAME,ua3f,DIRECT
  - MATCH,ua3f
```

这里值得注意的是，请确保 `PROCESS-NAME,ua3f,DIRECT` 置于规则列表的最顶部。
对于部分用户有代理加密需求的用户，可以在上述 2 条规则之间加入自定义的加密代理规则，例如:

```yaml
rules:
  - PROCESS-NAME,ua3f,DIRECT
  - DOMAIN-SUFFIX,google.com,Proxy
  - MATCH,ua3f
```

通过与加密代理的配合，可以实现：
- 直连网络流量通过 UA3F 进行处理转发
- 加密代理网络流量通过 Clash 连接外部代理服务器进行代理转发

# 结束
校园网防共享检测的需求对我来说已经消失，但是观察到目前现有方法的限制与问题，我进行了 UA3F 的初步实现，目前已经开源: https://github.com/SunBK201/UA3F，UA3F 的实现处于初级阶段，可能存在一些问题，因此欢迎各位同学进行反馈与指正。

欢迎加入讨论组进行讨论交流：[Telegram](https://t.me/crack_campus_network)
