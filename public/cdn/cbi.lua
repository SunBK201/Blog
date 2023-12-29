local uci = require("luci.model.uci").cursor()

ua3f = Map("ua3f",
    "UA3F",
    [[
        <a href="https://github.com/SunBK201/UA3F" target="_blank">Version: 0.2.0</a>
        <br>
        Across the Campus we can reach every corner in the world.
    ]]
)

enable = ua3f:section(NamedSection, "enabled", "ua3f", "Status")
main = ua3f:section(NamedSection, "main", "ua3f", "Settings")

enable:option(Flag, "enabled", "Enabled")
status = enable:option(DummyValue, "status", "Status")
status.rawhtml = true
status.cfgvalue = function(self, section)
    local pid = luci.sys.exec("pidof ua3f")
    if pid == "" then
        return "<span style='color:red'>" .. translate("Stopped") .. "</span>"
    else
        return "<span style='color:green'>" .. translate("Running") .. "</span>"
    end
end

main:tab("general", "General Settings")
main:tab("log", "Log")

port = main:taboption("general", Value, "port", "Port")
port.placeholder = "1080"
bind = main:taboption("general", Value, "bind", "Bind Address")
bind:value("127.0.0.1")
bind:value("0.0.0.0")
ua = main:taboption("general", Value, "ua", "User-Agent")
ua.placeholder = "FFF"
log_level = main:taboption("general", ListValue, "log_level", "Log Level")
log_level:value("debug")
log_level:value("info")
log_level:value("warn")
log_level:value("error")

log = main:taboption("log", TextValue, "")
log.readonly = true
log.cfgvalue = function(self, section)
    return luci.sys.exec("cat /var/log/ua3f.log")
end
log.rows = 30

return ua3f
