---
title: "main 通常是个函数，那么什么时候不是呢？"
date: 2021-06-18
draft: false
---

这始于我的同伴，尽管他已经知道如何编程，但却被迫参加我大学的计算机科学入门课程。我们跟他开玩笑说，他需要做一个可以运行的程序，但是评分的老师不能搞明白它是如何运行的。所以要求就是制作一个满足作业要求的程序，同时又要混淆视听，让评分人认为它不应该能运行起来。考虑到这一点，我开始回想起之前见过的C语言技巧库，其中有一点特别突出。我将通过这个技巧完成这个特殊的程序，这个技巧的想法来自一篇博客 [main is usually a function](http://mainisusuallyafunction.blogspot.com/)，这让我想到什么时候 main 不是一个函数？

（你可以`下载`我在这里写的代码，注意我是在 64-bit Linux 进行编写的，因此你如果在其它平台运行，你或许需要进行调整。）

我解决问题的过程通常和大多数程序员做的事情一样。第 1 步：在谷歌上搜索有关问题。第 2 步：点击第一页上每个看起来相关的链接。如果没有解决，尝试不同的查询，然后重复。值得庆幸的是，这个问题的[答案](http://stackoverflow.com/a/2252429/745719)出现在 Stackoverflow 首次搜索中。在 1984 年，一个奇怪的程序赢得了 IOCCC，其中 main 被声明为 `short main[] = {...}`，不知何故，这个程序成功做了一些事情，并打印到屏幕上！这是一个很好的例子。不幸的是，它是为一个完全不同的架构和编译器编写的，所以我真的没有简单的方法来找出它做了什么，但从它只是一堆数字的事实来看，我可以推测，那里的数字只是一些短函数的编译二进制，链接器在寻找主函数时只是把它扔到它的位置。

有了我们的假设，即程序的代码只是以数组形式表示的主函数的编译汇编，让我们看看是否可以通过制作一个小程序来复制这一现象，看看我们是否可以做到这一点。

```c
char main[] = "Hello world!";
```
```bash
$ gcc -Wall main_char.c -o first
main_char.c:1:6: warning: ‘main’ is usually a function [-Wmain]
  char main[] = "Hello world!";
      ^
$ ./first
Segmentation fault
```

好了，它成功了… 因此我们的下一个目标是它能真正打印一些东西到屏幕上。回想一下我有限的 ASM 经验，我记得有不同的 section 决定了不同东西的去处。与我们最相关的两个section是.text section 和 .datasection。.text 包含所有可执行的代码，它是只读的，而 .data 包含可读和可写的代码，但它是不可执行的。在我们的例子中，我们只能填入 main 函数的代码，所以任何被放在 .data section 的东西都是不可行的。我们需要找到一种方法，在 main 函数内获得字符串 “Hello world!” 并引用它。

我开始研究如何用尽可能少的代码来打印东西。由于我知道目标系统将是64位Linux，我发现我可以调用系统的写入调用，它将会输出到屏幕上。现在回过头来看这段代码，我认为我不需要为此使用汇编，但同时，我真的很高兴我能够学到一些东西。开始写内联 GCC ASM 是最难的部分，但一旦我掌握了它，一切就开始变得容易了。

不过，开始并不容易。事实证明，我通过谷歌能找到的大部分ASM知识都是以下内容：非常老旧，英特尔的语法，而且是 32 位系统。记住在我们的方案中，我们需要文件在 64 位系统上用 gcc 编译，不需要对编译器标志进行任何特殊的修改，所以这意味着没有特殊的编译标志，也不能包括任何自定义的链接步骤，我们要使用 GCC 内联 AT&T 语法。我的大部分时间都花在了寻找有关64位系统的现代汇编的信息上了！我想这是一个很好的例子。也许是我的 Google-fu 有所欠缺 :) 这一部分几乎都是试验和错误。我的目标只是用 gcc inline ASM 的 write syscall 向屏幕打印 “Hello world!"，为什么这么难呢？对于想学习如何做这个的人，我推荐以下网站： Linux syscall list, Intro to Inline ASM, Differences between Intel and AT&T Syntax.

最终，我的 ASM 代码完成了，而且看起来它可以工作！记住，我的目标是制作一个 main，它是一个打印 Hello World 的 ASM 数组。

```c
void main() {
    __asm__ (
        // print Hello World
        "movl $1, %eax;\n"  /* 1 is the syscall number for write on 64-bit */
        "movl $1, %ebx;\n"  /* 1 is stdout and is the first argument */
        "movl $message, %esi;\n" /* load the address of string into the second argument*/
        "movl $13, %edx;\n"  /* third argument is the length of the string to print*/
        "syscall;\n"
        // call exit (so it doesn't try to run the string Hello World)
        // maybe I could have just used ret instead?
        "movl $60,%eax;\n"
        "xorl %ebx,%ebx; \n"
        "syscall;\n"
        // Store the Hello World inside the main function
        "message: .ascii \"Hello World!\\n\";"
    );
}
```
```bash
$ gcc -Wall asm_main.c -o second
asm_main.c:1:6: warning: return type of ‘main’ is not ‘int’ [-Wmain]
  void main() {
      ^
$ ./second
Hello World!
```
YES! 它打印出来了! 现在让我们看看编译后的十六进制代码，它应该与我们写的 ASM 代码一一对应起来。
```c
(gdb) disass main
  Dump of assembler code for function main:
      0x00000000004004ed <+0>:     push   %rbp             ; Compiler inserted
      0x00000000004004ee <+1>:     mov    %rsp,%rbp
      0x00000000004004f1 <+4>:     mov    $0x1,%eax        ; It's our code!
      0x00000000004004f6 <+9>:     mov    $0x1,%ebx
      0x00000000004004fb <+14>:    mov    $0x400510,%esi
      0x0000000000400500 <+19>:    mov    $0xd,%edx
      0x0000000000400505 <+24>:    syscall
      0x0000000000400507 <+26>:    mov    $0x3c,%eax
      0x000000000040050c <+31>:    xor    %ebx,%ebx
      0x000000000040050e <+33>:    syscall
      0x0000000000400510 <+35>:    rex.W                   ; String hello world
      0x0000000000400511 <+36>:    gs                      ; it's garbled since
      0x0000000000400512 <+37>:    insb   (%dx),%es:(%rdi) ; it's not real ASM
      0x0000000000400513 <+38>:    insb   (%dx),%es:(%rdi) ; so it couldn't be
      0x0000000000400514 <+39>:    outsl  %ds:(%rsi),(%dx) ; disassembled
      0x0000000000400515 <+40>:    and    %dl,0x6f(%rdi)
      0x0000000000400518 <+43>:    jb     0x400586
      0x000000000040051a <+45>:    and    %ecx,%fs:(%rdx)
      0x000000000040051d <+48>:    pop    %rbp             ; Compiler-inserted
      0x000000000040051e <+49>:    retq
End of assembler dump.
```

这看起来是个有戏的 main，现在让我们去抓取它的十六进制内容，并将其作为字符串 dump 出去，看看是否能正常工作。我的方法是加载 gdb，像这样在 main 处打印 hex。上次我们拆解 main 的时候，看到它有 49 个字节长，所以可以用 dump 命令把十六进制保存到文件中。

```c
# example of how to print the hex
(gdb) x/49xb main
0x4004ed <main>:    0x55    0x48    0x89    0xe5    0xb8    0x01    0x00    0x00
0x4004f5 <main+8>:  0x00    0xbb    0x01    0x00    0x00    0x00    0xbe    0x10
0x4004fd <main+16>: 0x05    0x40    0x00    0xba    0x0d    0x00    0x00    0x00
0x400505 <main+24>: 0x0f    0x05    0xb8    0x3c    0x00    0x00    0x00    0x31
0x40050d <main+32>: 0xdb    0x0f    0x05    0x48    0x65    0x6c    0x6c    0x6f
0x400515 <main+40>: 0x20    0x57    0x6f    0x72    0x6c    0x64    0x21    0x0a
0x40051d <main+48>: 0x5d
# example of how to save it to a file
(gdb) dump memory hex.out main main+49
```

现在我们有了 hex dump，我们可以用我知道的最简单的方法将它们全部转换成整数，那就是使用 python。在Python 2.6 和 2.7中，你可以用下面的方法将其转换为方便我们使用的 int 数组。
```py
>>> import array
>>> hex_string = "554889E5B801000000BB01000000BE10054000BA0D0000000F05B83C00000031DB0F0548656C6C6F20576F726C64210A5D".decode("hex")
>>> array.array('B', hex_string)
array('B', [85, 72, 137, 229, 184, 1, 0, 0, 0, 187, 1, 0, 0, 0, 190, 16, 5, 64, 0, 186, 13, 0, 0, 0, 15, 5, 184, 60, 0, 0, 0, 49, 219, 15, 5, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 10, 93])
```

我想如果我的 bash foo 和 unix 知识更丰富的话，我可以找到一个更简单的方法来做这件事，但在谷歌上搜索 “编译后的函数的十六进制转储 “这样的东西，会得到几个关于如何用各种语言打印十六进制的问题。不管怎么说，我们现在有了一个逗号分隔的函数数组，所以让我们把它放到一个新的文件中。
```c
char main[] = {
    85,                 // push   %rbp
    72, 137, 229,       // mov    %rsp,%rbp
    184, 1, 0, 0, 0,    // mov    $0x1,%eax
    187, 1, 0, 0, 0,    // mov    $0x1,%ebx
    190, 16, 5, 64, 0,  // mov    $0x400510,%esi
    186, 13, 0, 0, 0,   // mov    $0xd,%edx
    15, 5,              // syscall
    184, 60, 0, 0, 0,   // mov    $0x3c,%eax
    49, 219,            // xor    %ebx,%ebx
    15, 5,              // syscall
    // Hello world!\n
    72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
    33, 10,             // pop    %rbp
    93                  // retq
};
```

```bash
$ gcc -Wall compiled_array_main.c -o third
compiled_array_main.c:1:6: warning: ‘main’ is usually a function [-Wmain]
  char main[] = {
      ^
$ ./third
Segmentation fault
```

Segfault！我做错了什么？是时候再次启动 gdb，看看错误是什么了。由于 main 不再是一个函数，我们不能简单地使用 break main 来在那里设置断点。相反，我们可以使用 break _start 在调用 libc runtime startup 的方法上获得一个断点（该函数调用 main），我们可以看到我们传递给 __libc_start_main 的地址。

```c
$ gdb ./third
(gdb) break _start
(gdb) run
(gdb) layout asm
    ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 B+>│0x400400 <_start>                       xor    %ebp,%ebp                                                                       │
    │0x400402 <_start+2>                     mov    %rdx,%r9                                                                        │
    │0x400405 <_start+5>                     pop    %rsi                                                                            │
    │0x400406 <_start+6>                     mov    %rsp,%rdx                                                                       │
    │0x400409 <_start+9>                     and    $0xfffffffffffffff0,%rsp                                                        │
    │0x40040d <_start+13>                    push   %rax                                                                            │
    │0x40040e <_start+14>                    push   %rsp                                                                            │
    │0x40040f <_start+15>                    mov    $0x400560,%r8                                                                   │
    │0x400416 <_start+22>                    mov    $0x4004f0,%rcx                                                                  │
    │0x40041d <_start+29>                    mov    $0x601060,%rdi                                                                  │
    │0x400424 <_start+36>                    callq  0x4003e0 <__libc_start_main@plt>                                                │
```

通过测试，我发现在 %rdi 上 push 的值是 main 的位置，但这次似乎有些不对劲。等一下，它把 main 放在了 .data 部分! 早些时候我提到了 .text 是只读可执行代码的位置，而 .data 是不可执行的读写值的位置！这就是问题所在，这段代码试图运行被标记为不可执行的内存，这是导致 segfault 的原因。我怎么能让编译器相信我的 "main" 属于 .text 呢！？好吧，我的搜索结果是空的，我确信这就是道路的尽头。是时候收工了，game over。

但那晚没有找到解决方案我就无法入睡。我继续搜索，再搜索，直到我在一个 stackoverflow 的帖子上找到一个非常明显和简单的解决方案，可惜我已经找不到网址了。我所要做的就是把 main 函数声明 为const 把它改成 `const char main[] = {` 从而让它进入正确的 section，所以让我们再试着编译。

```bash
$ gcc -Wall const_array_main.c -o fourth
const_array_main.c:1:12: warning: ‘main’ is usually a function [-Wmain]
  const char main[] = {
            ^
$ ./fourth
SL).....]
```

emmmm, 它现在在做什么! 是时候再次使用 gdb，看看发生了什么。

```c
gdb ./fourth
(gdb) break _start
(gdb) run
(gdb) layout asm
```

所以看一下代码，我们可以看到 main 的地址在 ASM 的 _start 指令中，在我的机器上看起来是这样的 `mov $0x4005a0,%rdi` 我们可以用这个在 main 上设置一个断点，通过做 `break *0x4005a0`，然后用 c 继续执行。

```c
(gdb) break *0x4005a0
(gdb) c
(gdb) x/49i $pc     # $pc is the current executing instruction
...
    0x4005a4 <main+4>:   mov    $0x1,%eax
    0x4005a9 <main+9>:   mov    $0x1,%ebx
    0x4005ae <main+14>:  mov    $0x400510,%esi
    0x4005b3 <main+19>:  mov    $0xd,%edx
    0x4005b8 <main+24>:  syscall
...
```

我剪掉了一些不重要的汇编。如果你没有注意到出错的地方，push 到 print 的地址 (0x400510) 并不是我们存储字符串 `"Hello world!\n "` 的地址(0x4005c3)！它实际上仍然指向原始编译的可执行文件中的计算位置，而不是使用相对寻址来打印它。这意味着我们需要修改汇编代码，以便加载相对于当前地址的字符串的地址。就目前而言，在 32 位代码中完成这个任务相当困难，但幸运的是我们使用的是 64 位ASM，所以我们可以使用 lea 指令来轻松完成。

```c
void main() {
  __asm__ (
        // print Hello World
        "movl $1, %eax;\n"  /* 1 is the syscall number for write */
        "movl $1, %ebx;\n"  /* 1 is stdout and is the first argument */
        // "movl $message, %esi;\n" /* load the address of string into the second argument*/
        // instead use this to load the address of the string
        // as 16 bytes from the current instruction
        "leal 16(%eip), %esi;\n"
        "movl $13, %edx;\n"  /* third argument is the length of the string to print*/
        "syscall;\n"
        // call exit (so it doesn't try to run the string Hello World
        // maybe I could have just used ret instead
        "movl $60,%eax;\n"
        "xorl %ebx,%ebx; \n"
        "syscall;\n"
        // Store the Hello World inside the main function
        "message: .ascii \"Hello World!\\n\";"
    );
}
```

```bash
$ gcc -Wall relative_str_asm.c -o fifth
relative_str_asm.c:1:6: warning: return type of ‘main’ is not ‘int’ [-Wmain]
  void main() {
      ^
$ ./fifth
Hello World!
```

现在我们可以使用前面讨论过的技术，将十六进制的值提取成一个整数数组。但是这一次，我想通过使用整整 4 个字节的 ints 来使它变得更有伪装性和技巧性。我们可以通过在 gdb 中把信息作为一个 int 打印出来，而不是把十六进制转储到一个文件中，然后再复制粘贴到程序中。

```c
gdb ./fifth
(gdb) x/13dw main
0x4004ed <main>:    -443987883  440 113408  -1922629632
0x4004fd <main+16>: 4149    899584  84869120    15544
0x40050d <main+32>: 266023168   1818576901  1461743468  1684828783
0x40051d <main+48>: -1017312735
```

我选择了数字 13，因为 main 的长度为 49 字节，为了安全起见，49/4 取整为 13。由于我们提前退出了这个函数，所以应该不会有什么影响。现在剩下的就是把这个复制粘贴到我们的 compiled_array_main.c 中并运行它。

```c
const int main[] = {
  -443987883, 440, 113408, -1922629632,
  4149, 899584, 84869120, 15544,
  266023168, 1818576901, 1461743468, 1684828783,
  -1017312735
};
```

```bash
$ gcc -Wall final_array.c -o sixth
final_array.c:1:11: warning: ‘main’ is usually a function [-Wmain]
  const int main[] = {
            ^
$ ./sixth
Hello World!
```

自始至终，我们都忽略了关于 warning: ‘main’ is usually a function 的警告信息 :)

我猜，当我的朋友交出这样的作业时，会因为糟糕的编码风格而扣分，然而并不会说别的......

This is a version from [James Rowe](http://jroweboy.github.io/about/).


