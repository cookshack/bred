# Bred

message ("==== Sample ====")

project (test,
  VERSION 0.1.0
  LANGUAGES C)

include (FindPkgConfig)

if (NOT CMAKE_BUILD_TYPE)
  set (CMAKE_BUILD_TYPE Debug)
endif (NOT CMAKE_BUILD_TYPE)

OPTION (EXAMPLE "Enable example feature" OFF)

set (VARIABLE 1)

enable_testing ()

add_subdirectory (src)

add_executable (example main.c)

target_link_libraries (example m)

install (TARGETS gvmd
         RUNTIME DESTINATION "${CMAKE_INSTALL_PREFIX}/sbin"
         LIBRARY DESTINATION "${CMAKE_INSTALL_PREFIX}/lib")
