---
title: "关于 iOS SSID 格式字符串 BUG 的快速分析"
date: 2021-06-21
draft: false
---

数天前，Twitter 上的[一条推文](https://twitter.com/vm_call/status/1405937492642123782)爆出了一个iOS Wi-Fi 的 BUG：

> @vm_call: After joining my personal WiFi with the SSID “%p%s%s%s%s%n”, my iPhone permanently disabled it’s WiFi functionality. Neither rebooting nor changing SSID fixes it :~)

![](https://sunbk201.oss-cn-beijing.aliyuncs.com/img/20210621105740.png)

看起来这是一个格式化字符串的错误，现在这种 BUG 已经很少见了。我用相同的 SSID 设置了一个热点，用我的测试设备尝试加入，wifid 很快就崩掉了。

以下是崩溃日志 `wifid-2021-06-20-xxxxxx.ips`:

```
Thread 2 name:  Dispatch queue: com.apple.wifid.managerQueue
Thread 2 Crashed:
0   libsystem_platform.dylib      	0x00000001ebcb9724 _platform_strlen + 4
1   CoreFoundation                	0x00000001a381d84c __CFStringAppendFormatCore + 8812
2   CoreFoundation                	0x00000001a381efa8 _CFStringCreateWithFormatAndArgumentsReturningMetadata + 160
3   WiFiPolicy                    	0x00000001d0895f8c -[WFLogger WFLog:message:] + 192
4   ???                           	0x000000010692c00c 0 + 4405248012
5   wifid                         	0x0000000100f58a74 0x100e40000 + 1149556
6   wifid                         	0x0000000100f58c74 0x100e40000 + 1150068
```

所以这真的是格式化字符串错误！

反编译 dyld_shared_cache 中的这个函数 `-[WFLogger WFLog:message:]`，有 2 处对 `CFStringCreateWithFormatAndArguments` 的引用:

```c
v7 = j__CFStringCreateWithCString_107(0LL, a4, 0x8000100u); // the format string
    if ( v7 || (v7 = j__CFStringCreateWithCString_107(0LL, a4, 0)) != 0LL )
  {
  if ( self->_destination == 2 )
  {
    v8 = j__CFStringCreateWithFormatAndArguments_26(0LL, 0LL, v7, v21);
    v18[3] = (__int64)v8;
  }

```
```c
 if ( self->_destination != 2
  && (!self->_wflRunningOnWatchClassDevice || self->_wflEnableDualLoggingOnWatchClassDevice) )
{
  *(_QWORD *)&v16.tm_sec = 0LL;
  *(_QWORD *)&v16.tm_hour = &v16;
  *(_QWORD *)&v16.tm_mon = 0x2020000000LL;
  *(_QWORD *)&v16.tm_wday = 0LL;
  v10 = j__CFStringCreateWithFormatAndArguments_26(0LL, 0LL, v7, v21); // <-- here
```

用 lldb debug 这个 issue 很麻烦了，因为这个 method 太常见了。因此，使用 frida frida-trace -U wifid -m '-[WFLogger WFLog:message:]', 然后使用以下通知脚本：
```c
  onEnter(log, args, state) {
  const msg = '' + args[3].readUtf8String();
  log(`-[WFLogger WFLog:${args[2]} message:${msg}]`);
  if (msg.indexOf('%p%s%s%s%s%n') > -1) {
    for (let i = 3; i < 10; i++) {
      log(args[i], JSON.stringify(Process.findRangeByAddress(args[i])));
    }

    log('called from:\n' +
      Thread.backtrace(this.context, Backtracer.ACCURATE)
      .map(DebugSymbol.fromAddress).join('\n') + '\n');
  }
},
```

这是在崩溃之前的日志：
```
17863 ms -[WFLogger WFLog:0x3 message:Dequeuing command type: “%@” pending commands: %ld]

17863 ms -[WFLogger WFLog:0x3 message:{ASSOC+} Attempting Apple80211AssociateAsync to %p%s%s%s%s%n]
```

根据 backtrace，这就是根本原因：
```c
v27 = sub_1000A25D4(v21);
v28 = objc_msgSend(
        &OBJC_CLASS___NSString,
        "stringWithFormat:",
        CFSTR("Attempting Apple80211AssociateAsync to %@"),
        v27);
v29 = objc_msgSend(&OBJC_CLASS___NSString, "stringWithFormat:", CFSTR("{ %@+} %@"), CFSTR("ASSOC"), v28);
v30 = objc_autoreleasePoolPush();
v31 = (void *)qword_100251888;
if ( qword_100251888 )
{
    v32 = objc_msgSend(v29, "UTF8String");
    objc_msgSend(v31, "WFLog:message:", 3LL, v32);
}
objc_autoreleasePoolPop(v30);
```

它将 SSID concat 到一个格式字符串，并将其传递给 `WFLog:message:` 方法，目的地是 3，所以是 `CFStringCreateWithFormatAndArguments` 的第二个 xref 引发了拒绝服务。

对于可利用性，目前还没有问题，其余的参数也不像是可以控制的。因此，我不认为这个 bug 是可利用的。毕竟，要触发这个 bug，你需要连接到该 WiFi，其中的 `SSID` 对受害者是可见的。钓鱼 Wi-Fi 或许更有效。

This is a version from [Schou](https://blog.chichou.me/).