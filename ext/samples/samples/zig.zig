// Bred

const std = @import("std");

const bignum = 99383;

fn fib(n: u16) u16 {
    if (n == 0 or n == 1)
        return n;
    return fib(n - 1) + fib(n - 2);
}

/// Increment a number.
fn incr(n: i32) i32 {
    return n + 1;
}

test "incrNeg" {
    try std.testing.expect(incr(-1) == 0);
}

test "comptime" {
    const f3 = comptime blk: {
        break :blk fib(3);
    };
    try std.testing.expect(f3 > 0);
}

fn pnt(comptime T: type) type {
    return struct {
        const Self = @This();
        x: T,
        y: T,
    };
}

pub fn main() !void {
    var index: i32 = 0;
    var sum: i32 = 0;
    const a = [_]i32{ 1, 2, 3, 4, 5 };

    // multiline string
    const msg = 
        \\oh...
        \\...hi.
        \\
    ;

    std.debug.print(msg, .{});

    while (index < 100) : (index = incr(index))
        sum += index;

    const writer = std.io.getStdOut().writer();
    var bwriter = std.io.bufferedWriter(writer);
    const stdout = bwriter.writer();

    try stdout.print("sum: {}\n", .{sum});
    if (sum > 1)
        try stdout.print("sum is positive\n", .{});

    sum = 0;
    const sum2: i32 = for (a) |val| {
        sum += val;
    } else sum;
    try stdout.print("sum2: {}\n", .{sum2});

    var sum3: i32 = 10;
    while (sum3 > 4)
        sum3 -= 1;
    try stdout.print("sum3: {}\n", .{sum3});

    var b1: u32 = 0;
    var b2: u32 = 1;
    //b1 = b2 = 2; // error: expected ';' after statement
    b1 = b2;
    //(b2 = 0); // error: expected ')', found '='
    b2 = 0;
    try stdout.print("b1: {}\n", .{b1});

    const c1 = 0;
    const c2 = if (c1 < 10) c1 + 7 else 99;
    try stdout.print("c2: {}\n", .{c2});

    try stdout.print("done.\n", .{});

    try bwriter.flush();
}
