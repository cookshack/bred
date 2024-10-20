# Bred

proc = self()

defmodule Words do
  def hi do
    'hi'
  end
end

defmodule Test do
  def hi do
    IO.puts(Words.hi)
  end

  def say(word) do
    if word in ['hi'] do say('Hi') else IO.puts(word) end
  end
end

Test.hi

spawn_link(fn ->
  send(proc, {:word, Words.hi})
end)

receive do
  {:word, word} -> Test.say(word)
end
