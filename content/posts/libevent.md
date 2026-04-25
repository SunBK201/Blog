---
title: "深入理解 libevent"
date: 2026-04-24
draft: false
---

libevent 是一个事件驱动的网络库，利用事件循环机制来处理网络事件。libevent 是很多著名开源项目的依赖库，如 Chromium、Envoy、Tor。本文将深入理解 libevent 的设计和实现。

# libevent 高层架构

{{< img src="https://sunbk201.oss-cn-beijing.aliyuncs.com/uPic/libevent-arch.png" alt="libevent" width="320" >}}

libevent 的组成如下：
- event_base、event：libevent 的核心组件，负责事件循环和事件管理。
- bufferevent：基于 event_base 的缓冲系统，提供了更高层次的接口来处理网络 I/O，支持自动缓冲和事件通知。
- evdns、evhttp、evrpc：基于 event_base 的 DNS、HTTP、RPC 模块，提供了更高层次的网络服务接口。

# libevent 核心：event_base

![event_base](https://sunbk201.oss-cn-beijing.aliyuncs.com/uPic/libevent.png)

event_base 是 libevent 的核心组件，在一次事件循环中涉及 event_base 中的关键组成包括：
- evbase：libevent 实际选择的多路复用器后端实例，如 epoll、kqueue、select 等。
- event_io_map：用于存储所有注册的 event，当调用 `event_add` 注册事件时，会将 event 添加到 event_io_map 中。
- activequeues：用于存储所有活跃事件的队列，当事件就绪时，会将对应的 event 添加到 activequeues 中，等待被处理。
- timeheap：libevent 的定时事件堆，是存储所有定时事件的最小堆，当定时事件到期时，会将对应的 event 添加到 activequeues 中。

值得注意的是：
- `activequeues` 不是一个队列，而是一组“按优先级分层”的队列。libevent 总是先处理最高优先级（数值最小）的活跃事件。
- `event_changelist` 用于批量合并对 fd 监听状态的修改，减少系统调用次数（尤其在 epoll 场景下很有价值）。


基于 event_base，用户围绕 `event_base_new`、`event_new`、`event_add`、`event_del`、`event_base_dispatch` 等接口进行事件注册管理和事件循环的控制：
- `event_base_new`：创建一个新的 event_base 实例，初始化多路复用器后端和相关数据结构。
- `event_new`：创建一个新的 event 实例，指定事件类型（如 EV_READ、EV_WRITE、EV_TIMEOUT 等）和回调函数。
- `event_add`：将 event 添加到 event_base 中，注册事件并指定超时时间（如果是定时事件）。
- `event_del`：从 event_base 中删除 event，取消事件注册。
- `event_base_dispatch`：启动事件循环，等待事件发生并调用对应的回调函数进行处理。

一个 `event` 典型会经过以下生命周期：
1. 创建：`event_new`（仅构建对象，不进入调度）。
2. 注册：`event_add`（进入 I/O map 或 timeheap）。
3. 激活：I/O 就绪或超时到期后，进入 `activequeues`。
4. 执行：回调被调用。
5. 再次注册或销毁：
	- 非 `EV_PERSIST` 事件，触发后通常会自动从监听中移除。
	- `EV_PERSIST` 事件会保留监听状态，可持续触发。

## event_base_new

1. 创建单调定时器
2. 初始化 timeheap
3. 初始化 active_later_queue
4. 初始化 event_io_map、event_signal_map
5. 初始化 event_changelist
6. 从 eventops 中选择后端多路复用器
7. 新建后端实例
8. 初始化 activequeues

实践上，`event_base_new_with_config` 更常见，因为你可以显式控制后端选择策略，例如：
- 禁用某些后端（例如调试时临时禁用 epoll）。
- 开启特性要求（如边沿触发支持）。
- 设置 `EVENT_BASE_FLAG_NOLOCK` 等标志（需结合线程模型谨慎使用）。

## event_add

1. 在 timeheap 中预留一个位置
2. 如果 event 不在 event_io_map 或 activequeues 中，则将 event 注册到 event_io_map
3. 计算超时时间，将 event 插入 timeheap

这里有两个语义细节非常重要：
- 对 I/O 事件传入 `tv != NULL`，表示“给这次 I/O 监听附带一个超时上限”。超时到了会收到 `EV_TIMEOUT`。
- 对纯定时事件（如 `evtimer_new`）来说，`event_add` 的 `tv` 就是“下一次触发时间”。

若事件已在 pending 状态，再次 `event_add` 通常意味着刷新其超时时间（具体表现取决于事件类型和是否 `EV_PERSIST`）。

## event_del

1. 从 timeheap 中移除 event
2. 如果 event 在 activequeues 中则将其移除
3. 如果 event 在 event_io_map 中则将其移除

`event_del` 的核心作用是“取消后续触发”，但并不回收 `event` 本身内存。通常流程是：
- 先 `event_del`（如果仍可能处于注册状态）。
- 再 `event_free` 释放对象。

## event_base_dispatch

1. 根据 timeheap 中的堆顶时间计算一次 dispatch 的阻塞等待时间
2. 将 active_later_queue 中的 event 移动到 activequeues
3. 执行后端 dispatch，等待获取 IO 事件，并将对应的 event 加入 activequeues 中
4. 批量处理已到期的定时事件，对已到期事件将其从 event_io_map 中移除，并将其加入 activequeues
5. 执行 activequeues 中最高优先级（数值最小）的 event_callback，并将 event 从 activequeues 中移除

# 缓冲系统：bufferevent

![bufferevent](https://sunbk201.oss-cn-beijing.aliyuncs.com/uPic/bufferevent.png)

bufferevent 是基于 event_base 的缓冲系统，提供了更高层次的接口来处理网络 I/O，支持自动缓冲和事件通知。

如果说 `event` 是“原始事件”，那 `bufferevent` 就是“带缓冲和流控的连接对象”。它把“收发、回调、背压、超时”打包到一个统一模型里。

bufferevent 主要由以下组件组成：
- input_buffer、output_buffer: 输入输出缓冲区，用于存储待处理的网络数据。
- readcb、writecb、eventcb: 读写事件回调函数，当对应事件发生时会被调用。
- enabled: 状态标志，表示 bufferevent 当前的状态，如是否启用读写事件等。
- ev_base: 关联的 event_base 实例，用于事件循环和事件管理。
- ev_read、ev_write: 关联的 event 实例，用于注册读写事件到 event_base 中。
- timeout_read、timeout_write: 读写事件的超时时间，用于定时事件管理。
- wm_read、wm_write: 水位线，用于控制输入输出缓冲区的大小，实现应用层背压。

## 动态缓冲区：evbuffer

evbuffer 是 libevent 提供的一个高效的缓冲区实现，支持动态扩展和高效的数据操作。
bufferevent 内部使用 evbuffer 来管理输入输出缓冲区，其组成如下：
- buffer: 实际的缓冲区数据存储，支持动态扩展。
- misalign: 缓冲区数据的偏移量，用于优化数据操作。
- off: 缓冲区数据的长度，用于记录当前缓冲区中有效数据的长度。
- total_len: 缓冲区的总长度，用于记录当前缓冲区的总容量。
- refcnt: 引用计数，用于管理缓冲区的生命周期。
- flags: 状态标志，用于记录缓冲区的状态，如是否已锁定等。

evbuffer 的实际数据存储通常采用链表结构，由多个 evbuffer_chain 组成，每个 evbuffer_chain 包含一个固定大小的缓冲区和指向下一个 evbuffer_chain 的指针，这种设计允许 evbuffer 动态扩展而不需要频繁地进行内存复制。

这种结构使它具备零拷贝的能力，常见优化手段包括：
- `evbuffer_add_reference`：引用外部内存，避免立刻复制。
- `evbuffer_pullup`：在需要连续内存时再做整理。
- `evbuffer_remove_buffer`：在两个 buffer 间搬运数据，减少应用层手工 memcpy。

## 背压机制：watermark

bufferevent 的水位线用于控制读写回调：
- 读低水位（read low watermark）：`input_buffer` 达到该值才触发读回调。
- 读高水位（read high watermark）：达到上限时暂停继续读，防止内存失控。
- 写低水位（write low watermark）：`output_buffer` 下降到该值时触发写回调。

## 限流机制：rate limit

libevent 的 rate limit 底层实现基于令牌桶算法，本质是在用户态控制 read()/write() 读写来实现速率限制。

rate limit 与 watermark 的不同在于：
- watermark 控制缓冲区大小和回调触发时机；
- rate limit 控制单位时间内实际读写多少字节。

rate limit 的控制参数由 `ev_token_bucket_cfg` 定义，包含：
- `read_rate`：每个 tick 增加多少读令牌
- `read_maximum`：读令牌桶的最大容量
- `write_rate`：每个 tick 增加多少写令牌
- `write_maximum`：写令牌桶的最大容量
- `tick_timeout`：tick 时间长度，用于控制令牌增加的频率

read_rate 和 write_rate 不是“每秒字节数”，而是“每个 tick 的字节数”，实际速率 = rate / tick_len。

其中 read rate limit 限制的是 libevent 从 socket 读入到 bufferevent input buffer 的速度，
write rate limit 限制的是 libevent 从 bufferevent output buffer 写出到 socket 的速度。

在对一个 bufferevent 设置了 rate limit 后，libevent 会在每个 tick 定时器到期时检查当前的令牌数量，并根据需要暂停或恢复读写事件，以确保实际的读写速率不超过配置的限制。